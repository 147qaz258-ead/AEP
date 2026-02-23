"""
AEP SDK Collectors

This module provides collectors for automatically discovering and publishing
experiences from various sources (logs, errors, etc.).
"""

from .log import LogCollector, LogEntry, LogCollectorConfig

__all__ = [
    "LogCollector",
    "LogEntry",
    "LogCollectorConfig",
]
