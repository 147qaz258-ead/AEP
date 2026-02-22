"""
Tests for Agent Identity Store.

Tests platform-specific storage, persistence, and environment variable override.
"""

import os
import platform
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from aep_sdk.identity import (
    AgentIdentityStore,
    get_environment_agent_id,
    ensure_agent_id,
)


class TestAgentIdentityStore:
    """Tests for AgentIdentityStore class."""

    def test_validate_format_valid_ids(self):
        """Test that valid agent IDs pass format validation."""
        valid_ids = [
            "agent_0x1234567890abcdef",
            "agent_0x0000000000000000",
            "agent_0xffffffffffffffff",
            "agent_0xaaaaaaaaaaaaaaaa",
        ]
        for agent_id in valid_ids:
            assert AgentIdentityStore.validate_format(agent_id), f"Should accept {agent_id}"

    def test_validate_format_invalid_ids(self):
        """Test that invalid agent IDs fail format validation."""
        invalid_ids = [
            "agent_0x12345",  # Too short
            "agent_0x1234567890abcdefg",  # Invalid char
            "agent_1234567890abcdef",  # Missing 0x
            "Agent_0x1234567890abcdef",  # Uppercase
            "agent_0X1234567890abcdef",  # Uppercase X
            "",  # Empty
            "agent_0x1234567890abcde",  # 15 chars
            "agent_0x1234567890abcdef0",  # 17 chars
        ]
        for agent_id in invalid_ids:
            assert not AgentIdentityStore.validate_format(agent_id), f"Should reject {agent_id}"

    def test_save_and_load_agent_id(self):
        """Test basic save and load operations."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")
            agent_id = "agent_0x1234567890abcdef"

            store.save_agent_id(agent_id)
            loaded = store.load_agent_id()

            assert loaded == agent_id

    def test_save_invalid_format_raises(self):
        """Test that saving invalid format raises ValueError."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")

            with pytest.raises(ValueError, match="Invalid agent_id format"):
                store.save_agent_id("invalid-id")

    def test_load_nonexistent_file_returns_none(self):
        """Test that loading from nonexistent file returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "nonexistent" / "agent_id")

            result = store.load_agent_id()

            assert result is None

    def test_load_invalid_content_returns_none(self):
        """Test that loading invalid content returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "agent_id"
            path.write_text("invalid-content")

            store = AgentIdentityStore(custom_path=path)
            result = store.load_agent_id()

            assert result is None

    def test_clear_agent_id(self):
        """Test clearing the agent ID."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")
            agent_id = "agent_0x1234567890abcdef"

            store.save_agent_id(agent_id)
            assert store.has_agent_id()

            cleared = store.clear_agent_id()

            assert cleared is True
            assert not store.has_agent_id()

    def test_clear_nonexistent_returns_false(self):
        """Test clearing nonexistent file returns False."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "nonexistent")

            cleared = store.clear_agent_id()

            assert cleared is False

    def test_has_agent_id(self):
        """Test has_agent_id method."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")

            assert not store.has_agent_id()

            store.save_agent_id("agent_0x1234567890abcdef")
            assert store.has_agent_id()

    def test_creates_parent_directories(self):
        """Test that parent directories are created automatically."""
        with tempfile.TemporaryDirectory() as tmpdir:
            nested_path = Path(tmpdir) / "deeply" / "nested" / "dir" / "agent_id"
            store = AgentIdentityStore(custom_path=nested_path)

            store.save_agent_id("agent_0x1234567890abcdef")

            assert nested_path.exists()

    def test_get_or_create_storage_dir(self):
        """Test getting/creating storage directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "subdir" / "agent_id")

            dir_path = store.get_or_create_storage_dir()

            assert dir_path.exists()
            assert dir_path.is_dir()

    @pytest.mark.skipif(platform.system() == "Windows", reason="Unix permissions test")
    def test_file_permissions_unix(self):
        """Test that file permissions are set correctly on Unix."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")
            store.save_agent_id("agent_0x1234567890abcdef")

            path = store.get_storage_path()
            mode = path.stat().st_mode

            # Check that file is user-readable/writable only (0600)
            assert (mode & 0o777) == 0o600


class TestPlatformSpecificPaths:
    """Tests for platform-specific storage paths."""

    def test_get_storage_path_custom(self):
        """Test custom path override."""
        custom = Path("/custom/path/agent_id")
        store = AgentIdentityStore(custom_path=custom)

        result = store.get_storage_path()

        assert result == custom

    def test_get_storage_path_linux(self):
        """Test Linux storage path."""
        store = AgentIdentityStore()

        with patch("platform.system", return_value="Linux"):
            path = store.get_storage_path()
            # Should end with .config/aep/agent_id
            assert ".config" in str(path) or ".config" in path.parts

    def test_get_storage_path_darwin(self):
        """Test macOS storage path."""
        store = AgentIdentityStore()

        with patch("platform.system", return_value="Darwin"):
            path = store.get_storage_path()
            # Should contain Library/Application Support
            assert "Library" in str(path) or "Library" in path.parts

    def test_get_storage_path_windows(self):
        """Test Windows storage path."""
        store = AgentIdentityStore()

        with patch("platform.system", return_value="Windows"):
            with patch.dict(os.environ, {"APPDATA": "C:\\Users\\Test\\AppData\\Roaming"}):
                path = store.get_storage_path()
                # Should use APPDATA
                assert "AEP" in str(path)


class TestEnvironmentOverride:
    """Tests for environment variable override."""

    def test_get_environment_agent_id_valid(self):
        """Test getting valid agent ID from environment."""
        with patch.dict(os.environ, {"AEP_AGENT_ID": "agent_0x1234567890abcdef"}):
            result = get_environment_agent_id()
            assert result == "agent_0x1234567890abcdef"

    def test_get_environment_agent_id_not_set(self):
        """Test when environment variable is not set."""
        with patch.dict(os.environ, {}, clear=True):
            if "AEP_AGENT_ID" in os.environ:
                del os.environ["AEP_AGENT_ID"]
            result = get_environment_agent_id()
            assert result is None

    def test_get_environment_agent_id_invalid_raises(self):
        """Test that invalid environment value raises ValueError."""
        with patch.dict(os.environ, {"AEP_AGENT_ID": "invalid-id"}):
            with pytest.raises(ValueError, match="Invalid AEP_AGENT_ID format"):
                get_environment_agent_id()


class TestEnsureAgentId:
    """Tests for ensure_agent_id function."""

    def test_ensure_agent_id_from_environment(self):
        """Test ensure_agent_id uses environment variable first."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")

            with patch.dict(os.environ, {"AEP_AGENT_ID": "agent_0x1234567890abcdef"}):
                result = ensure_agent_id("http://hub.example.com", store)
                assert result == "agent_0x1234567890abcdef"

    def test_ensure_agent_id_from_storage(self):
        """Test ensure_agent_id loads from storage if no env var."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")
            store.save_agent_id("agent_0xaabbccdd11223344")

            with patch.dict(os.environ, {}, clear=True):
                if "AEP_AGENT_ID" in os.environ:
                    del os.environ["AEP_AGENT_ID"]
                result = ensure_agent_id("http://hub.example.com", store)
                assert result == "agent_0xaabbccdd11223344"

    def test_ensure_agent_id_no_id_raises(self):
        """Test ensure_agent_id raises when no ID available."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")

            with patch.dict(os.environ, {}, clear=True):
                if "AEP_AGENT_ID" in os.environ:
                    del os.environ["AEP_AGENT_ID"]
                with pytest.raises(RuntimeError, match="No agent_id found"):
                    ensure_agent_id("http://hub.example.com", store)

    def test_ensure_agent_id_invalid_env_raises(self):
        """Test ensure_agent_id re-raises ValueError for invalid env var."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = AgentIdentityStore(custom_path=Path(tmpdir) / "agent_id")

            with patch.dict(os.environ, {"AEP_AGENT_ID": "invalid"}):
                with pytest.raises(ValueError, match="Invalid AEP_AGENT_ID format"):
                    ensure_agent_id("http://hub.example.com", store)
