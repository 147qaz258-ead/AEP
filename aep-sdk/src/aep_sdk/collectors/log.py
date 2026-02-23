"""
Log Collector - Automatically collect errors from log files and publish as experiences.

This module provides functionality to:
- Watch log files for new entries
- Parse ERROR/WARN lines and extract error signatures
- Auto-publish discovered errors as experiences
- Support batch processing
"""

import glob
import os
import re
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

from ..client import AEPClient, AEPError


@dataclass
class LogEntry:
    """
    Represents a parsed log entry containing an error or warning.

    Attributes:
        raw_line: The original log line
        level: Log level (ERROR, WARN, WARNING, etc.)
        message: The error/warning message
        signature: Extracted error signature for matching
        timestamp: Timestamp from the log line (if available)
        source_file: Path to the source log file
        line_number: Line number in the source file
        context: Additional context metadata
    """

    raw_line: str
    level: str
    message: str
    signature: str
    source_file: str
    line_number: int
    timestamp: Optional[datetime] = None
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "raw_line": self.raw_line,
            "level": self.level,
            "message": self.message,
            "signature": self.signature,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "context": self.context,
        }


@dataclass
class LogCollectorConfig:
    """
    Configuration for the LogCollector.

    Attributes:
        hub_url: URL of the AEP Hub
        auto_publish: Whether to automatically publish discovered errors
        batch_size: Number of entries to collect before auto-publishing (0 = no batching)
        batch_interval: Seconds between batch publishes (0 = no interval-based batching)
        watch_interval: Seconds between file checks when watching
        levels: Log levels to capture (default: ERROR, WARN)
        min_confidence: Minimum confidence for auto-published experiences
        publish_callback: Optional callback after each publish
        error_callback: Optional callback for errors during processing
    """

    hub_url: str
    auto_publish: bool = False
    batch_size: int = 10
    batch_interval: float = 30.0
    watch_interval: float = 1.0
    levels: List[str] = field(default_factory=lambda: ["ERROR", "WARN", "WARNING", "CRITICAL", "FATAL"])
    min_confidence: float = 0.7
    publish_callback: Optional[Callable[[LogEntry, Dict[str, Any]], None]] = None
    error_callback: Optional[Callable[[Exception, LogEntry], None]] = None


# Common log format patterns
LOG_PATTERNS = [
    # ISO timestamp with level: 2024-02-23T10:00:00 ERROR message
    re.compile(
        r"^(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+"
        r"(?P<level>ERROR|WARN|WARNING|CRITICAL|FATAL)\s*"
        r"(?:\[(?P<component>[^\]]+)\])?\s*"
        r"(?P<message>.*)$",
        re.IGNORECASE,
    ),
    # Simple level prefix: ERROR: message
    re.compile(
        r"^(?P<level>ERROR|WARN|WARNING|CRITICAL|FATAL)[:\s]+(?P<message>.*)$",
        re.IGNORECASE,
    ),
    # Python-style logging: 2024-02-23 10:00:00,000 - module - ERROR - message
    re.compile(
        r"^(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:,\d+)?)\s+-\s+"
        r"(?P<component>\S+)\s+-\s+"
        r"(?P<level>ERROR|WARN|WARNING|CRITICAL|FATAL)\s+-\s+"
        r"(?P<message>.*)$",
        re.IGNORECASE,
    ),
    # Date prefix: [2024-02-23 10:00:00] [ERROR] message
    re.compile(
        r"^\[(?P<timestamp>[^\]]+)\]\s*\[(?P<level>ERROR|WARN|WARNING|CRITICAL|FATAL)\]\s*"
        r"(?P<message>.*)$",
        re.IGNORECASE,
    ),
]

# Error signature patterns to extract meaningful error types
SIGNATURE_PATTERNS = [
    # Python exceptions: TypeError: message
    re.compile(r"^(?P<type>\w+Error|\w+Exception):\s*(?P<msg>.*)$"),
    # JavaScript errors: TypeError: Cannot read property 'x' of undefined
    re.compile(r"^(?P<type>\w+Error):\s*(?P<msg>.+)$"),
    # Generic error codes: ECONNREFUSED, ETIMEDOUT, etc.
    re.compile(r"(?P<type>E[A-Z_]+):\s*(?P<msg>.+)$"),
    # Stack trace first line
    re.compile(r"^(?P<type>File\s+\".+\",\s*line\s+\d+).*"),
]


class LogCollector:
    """
    Log file collector for discovering and publishing error experiences.

    This collector can:
    - Watch log files for new entries in real-time
    - Process existing log files one-time
    - Parse and extract error signatures
    - Auto-publish discovered errors as experiences

    Usage:
        # Create collector with auto-publish
        collector = LogCollector(
            hub_url="http://localhost:3000",
            auto_publish=True
        )

        # Watch single file
        collector.watch("/var/log/app.log")

        # Watch directory
        collector.watch_dir("/var/log/", pattern="*.log")

        # One-time processing
        collector.process_file("/var/log/errors.log")

        # Set callback for discovered errors
        collector.on_error(lambda entry: print(f"Found: {entry}"))

        # Stop watching
        collector.stop()
    """

    def __init__(
        self,
        hub_url: str,
        auto_publish: bool = False,
        config: Optional[LogCollectorConfig] = None,
        client: Optional[AEPClient] = None,
    ):
        """
        Initialize the LogCollector.

        Args:
            hub_url: URL of the AEP Hub
            auto_publish: Whether to automatically publish discovered errors
            config: Optional full configuration object
            client: Optional pre-configured AEPClient (for testing)
        """
        if config:
            self._config = config
        else:
            self._config = LogCollectorConfig(
                hub_url=hub_url,
                auto_publish=auto_publish,
            )

        self._client = client
        self._watchers: Dict[str, threading.Thread] = {}
        self._file_positions: Dict[str, int] = {}
        self._stop_event = threading.Event()
        self._batch: List[LogEntry] = []
        self._batch_lock = threading.Lock()
        self._batch_timer: Optional[threading.Timer] = None
        self._callbacks: List[Callable[[LogEntry], None]] = []
        self._seen_signatures: Set[str] = set()
        self._running = False

    @property
    def client(self) -> AEPClient:
        """Get or create the AEP client."""
        if self._client is None:
            self._client = AEPClient(hub_url=self._config.hub_url)
        return self._client

    def _parse_timestamp(self, ts_str: Optional[str]) -> Optional[datetime]:
        """Parse timestamp string into datetime."""
        if not ts_str:
            return None

        # Try various formats
        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S,%f",
            "%Y-%m-%d %H:%M:%S.%f",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(ts_str.strip(), fmt)
            except ValueError:
                continue

        return None

    def _extract_signature(self, message: str) -> str:
        """
        Extract a signature from an error message for matching.

        This creates a normalized signature that can be used to identify
        similar errors across different log entries.
        """
        # Try to match known error patterns
        for pattern in SIGNATURE_PATTERNS:
            match = pattern.match(message.strip())
            if match:
                groups = match.groupdict()
                if "type" in groups:
                    error_type = groups["type"]
                    # Normalize specific values (numbers, paths, IPs)
                    msg = groups.get("msg", "")
                    # Remove specific values to create generic signature
                    msg = re.sub(r"\d+", "N", msg)  # Replace numbers
                    msg = re.sub(r"0x[0-9a-fA-F]+", "0xADDR", msg)  # Replace hex addresses
                    msg = re.sub(r"/[\w/.-]+", "/PATH", msg)  # Replace file paths
                    msg = re.sub(r"\d+\.\d+\.\d+\.\d+", "IP", msg)  # Replace IPs
                    return f"{error_type}: {msg[:100]}"

        # Fallback: normalize the message directly
        signature = message.strip()
        signature = re.sub(r"\d+", "N", signature)
        signature = re.sub(r"0x[0-9a-fA-F]+", "0xADDR", signature)
        signature = re.sub(r"/[\w/.-]+", "/PATH", signature)
        signature = re.sub(r"\d+\.\d+\.\d+\.\d+", "IP", signature)
        signature = re.sub(r"'[^']*'", "'...'", signature)
        signature = re.sub(r'"[^"]*"', '"..."', signature)

        return signature[:200]

    def _parse_line(self, line: str, source_file: str, line_number: int) -> Optional[LogEntry]:
        """
        Parse a log line and extract error information.

        Args:
            line: The log line to parse
            source_file: Path to the source file
            line_number: Line number in the file

        Returns:
            LogEntry if the line contains a relevant error, None otherwise
        """
        line = line.strip()
        if not line:
            return None

        for pattern in LOG_PATTERNS:
            match = pattern.match(line)
            if match:
                groups = match.groupdict()
                level = groups.get("level", "").upper()

                # Check if this level is one we care about
                if level not in [l.upper() for l in self._config.levels]:
                    continue

                message = groups.get("message", line)
                timestamp = self._parse_timestamp(groups.get("timestamp"))
                component = groups.get("component")
                signature = self._extract_signature(message)

                context = {}
                if component:
                    context["component"] = component

                return LogEntry(
                    raw_line=line,
                    level=level,
                    message=message,
                    signature=signature,
                    source_file=source_file,
                    line_number=line_number,
                    timestamp=timestamp,
                    context=context,
                )

        return None

    def _publish_entry(self, entry: LogEntry) -> Optional[Dict[str, Any]]:
        """
        Publish a log entry as an experience.

        Args:
            entry: The log entry to publish

        Returns:
            Publish result or None if not published
        """
        if not self._config.auto_publish:
            return None

        # Skip if we've already seen this signature
        if entry.signature in self._seen_signatures:
            return None

        try:
            result = self.client.publish(
                trigger=entry.signature,
                solution=f"Investigate and fix: {entry.message[:200]}",
                confidence=self._config.min_confidence,
                context={
                    "source": "log_collector",
                    "level": entry.level,
                    "file": entry.source_file,
                    "line": entry.line_number,
                    **entry.context,
                },
                signals_match=[entry.level, "auto_collected"],
            )

            self._seen_signatures.add(entry.signature)

            if self._config.publish_callback:
                self._config.publish_callback(entry, result.to_dict())

            return result.to_dict()

        except AEPError as e:
            if self._config.error_callback:
                self._config.error_callback(e, entry)
            return None

    def _process_batch(self) -> None:
        """Process accumulated batch of entries."""
        with self._batch_lock:
            if not self._batch:
                return

            entries_to_process = self._batch[:]
            self._batch.clear()

        for entry in entries_to_process:
            self._publish_entry(entry)

    def _add_to_batch(self, entry: LogEntry) -> None:
        """Add entry to batch and trigger publish if needed."""
        # Notify callbacks
        for callback in self._callbacks:
            try:
                callback(entry)
            except Exception:
                pass  # Ignore callback errors

        if not self._config.auto_publish:
            return

        # Skip duplicates
        if entry.signature in self._seen_signatures:
            return

        with self._batch_lock:
            self._batch.append(entry)

            # Check batch size trigger
            if self._config.batch_size > 0 and len(self._batch) >= self._config.batch_size:
                self._process_batch()

    def _watch_file(self, file_path: str) -> None:
        """
        Watch a file for new entries (runs in thread).

        Args:
            file_path: Path to the file to watch
        """
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                # Seek to end if we have a position, otherwise start fresh
                if file_path in self._file_positions:
                    f.seek(self._file_positions[file_path])
                else:
                    f.seek(0, 2)  # Seek to end

                while not self._stop_event.is_set():
                    line = f.readline()
                    if line:
                        self._file_positions[file_path] = f.tell()
                        entry = self._parse_line(
                            line, file_path, self._file_positions[file_path]
                        )
                        if entry:
                            self._add_to_batch(entry)
                    else:
                        # No new content, wait
                        time.sleep(self._config.watch_interval)

        except FileNotFoundError:
            # File was removed, stop watching
            pass
        except Exception as e:
            if self._config.error_callback:
                self._config.error_callback(e, LogEntry(
                    raw_line="",
                    level="ERROR",
                    message=str(e),
                    signature=f"watch_error: {file_path}",
                    source_file=file_path,
                    line_number=0,
                ))

    def watch(self, file_path: str) -> None:
        """
        Start watching a log file for new entries.

        Args:
            file_path: Path to the log file to watch
        """
        path = Path(file_path).resolve()
        path_str = str(path)

        if path_str in self._watchers:
            return  # Already watching

        self._stop_event.clear()

        # Start batch timer if configured
        if self._config.batch_interval > 0 and self._batch_timer is None:
            self._batch_timer = threading.Timer(self._config.batch_interval, self._process_batch)
            self._batch_timer.daemon = True
            self._batch_timer.start()

        # Start watcher thread
        thread = threading.Thread(
            target=self._watch_file,
            args=(path_str,),
            daemon=True,
        )
        thread.start()
        self._watchers[path_str] = thread
        self._running = True

    def watch_dir(self, directory: str, pattern: str = "*.log") -> None:
        """
        Watch all log files in a directory matching a pattern.

        Args:
            directory: Directory path to watch
            pattern: Glob pattern for log files (default: "*.log")
        """
        dir_path = Path(directory).resolve()

        if not dir_path.is_dir():
            raise ValueError(f"Directory not found: {directory}")

        for file_path in dir_path.glob(pattern):
            if file_path.is_file():
                self.watch(str(file_path))

    def process_file(
        self,
        file_path: str,
        from_beginning: bool = True,
    ) -> List[LogEntry]:
        """
        Process a log file one-time (not continuous watching).

        Args:
            file_path: Path to the log file
            from_beginning: If True, process from start; if False, only new entries

        Returns:
            List of discovered log entries
        """
        path = Path(file_path).resolve()
        path_str = str(path)

        if not path.is_file():
            raise FileNotFoundError(f"Log file not found: {file_path}")

        entries = []

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            # Determine starting position
            if from_beginning:
                start_pos = 0
            else:
                start_pos = self._file_positions.get(path_str, 0)

            f.seek(start_pos)
            line_number = start_pos

            for line in f:
                line_number += 1
                entry = self._parse_line(line, path_str, line_number)
                if entry:
                    entries.append(entry)
                    self._add_to_batch(entry)

            self._file_positions[path_str] = f.tell()

        # Process any remaining batch
        if self._config.auto_publish:
            self._process_batch()

        return entries

    def process_history(
        self,
        file_path: str,
        dry_run: bool = False,
    ) -> List[LogEntry]:
        """
        Process historical log file and optionally publish.

        Args:
            file_path: Path to the log file
            dry_run: If True, don't actually publish, just return entries

        Returns:
            List of discovered log entries
        """
        original_auto_publish = self._config.auto_publish
        if dry_run:
            self._config.auto_publish = False

        try:
            return self.process_file(file_path, from_beginning=True)
        finally:
            self._config.auto_publish = original_auto_publish

    def on_error(self, callback: Callable[[LogEntry], None]) -> None:
        """
        Register a callback for discovered error entries.

        Args:
            callback: Function to call with each discovered LogEntry
        """
        self._callbacks.append(callback)

    def stop(self) -> None:
        """Stop all file watchers."""
        self._stop_event.set()

        # Stop batch timer
        if self._batch_timer:
            self._batch_timer.cancel()
            self._batch_timer = None

        # Process any remaining entries
        if self._batch:
            self._process_batch()

        # Wait for threads to finish
        for thread in self._watchers.values():
            thread.join(timeout=2.0)

        self._watchers.clear()
        self._running = False

    def is_watching(self) -> bool:
        """Check if the collector is actively watching files."""
        return self._running and not self._stop_event.is_set()

    def get_stats(self) -> Dict[str, Any]:
        """
        Get collector statistics.

        Returns:
            Dictionary with statistics about the collector
        """
        return {
            "running": self.is_watching(),
            "files_watched": len(self._watchers),
            "unique_signatures": len(self._seen_signatures),
            "batch_size": len(self._batch),
            "file_positions": dict(self._file_positions),
        }

    def __enter__(self) -> "LogCollector":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.stop()
        if self._client:
            self._client.close()
