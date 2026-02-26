"""
Action Logger for AEP SDK.

This module provides the ActionLogger class for recording agent actions
to session files.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .models import (
    ActionType,
    ActionResult,
    AgentAction,
    create_action,
    generate_id,
)
from .recorder import SessionRecorder, SessionNotActiveError


@dataclass
class MessageLog:
    """
    Structured log entry for messages.

    Provides a convenient way to log conversations with detailed info.

    Attributes:
        user_message: The user's input message
        agent_message: The agent's response message
        tokens_used: Number of tokens used (optional)
        model: Model identifier (optional)
        context: Additional context (optional)
        result: Result status ('success', 'failure', or 'partial')
    """

    user_message: str
    agent_message: str
    tokens_used: Optional[int] = None
    model: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    result: str = "success"


class WriteError(Exception):
    """Raised when writing to session file fails."""
    pass


class ActionLogger:
    """
    Action logger for recording agent actions to session files.

    This class provides convenient methods for logging different types of
    agent actions (tool calls, messages, decisions) to the active session.

    Usage:
        recorder = SessionRecorder(workspace, agent_id)
        recorder.start_session()

        logger = ActionLogger(recorder)
        action_id = logger.log_tool_call(
            tool_name="bash",
            trigger="File not found",
            solution="Create file",
            result="success"
        )

    Attributes:
        recorder: The SessionRecorder instance used for persistence
    """

    def __init__(self, session_recorder: SessionRecorder):
        """
        Initialize the action logger.

        Args:
            session_recorder: The SessionRecorder instance to use for
                             persisting actions
        """
        self._recorder = session_recorder

    @property
    def recorder(self) -> SessionRecorder:
        """Get the underlying SessionRecorder."""
        return self._recorder

    def log_action(self, action: AgentAction) -> str:
        """
        Record an action to the active session.

        This is the general method for recording any AgentAction.
        Use convenience methods (log_tool_call, log_message, log_decision)
        for common action types.

        Args:
            action: The AgentAction to record

        Returns:
            The action ID

        Raises:
            SessionNotActiveError: If no session is currently active
            WriteError: If writing to the session file fails
        """
        session_id = self._recorder.get_active_session()
        if not session_id:
            raise SessionNotActiveError(
                "No active session. Call start_session() first."
            )

        # Measure latency
        start_time = time.perf_counter()

        try:
            self._recorder.record_action(action)
        except Exception as e:
            raise WriteError(f"Failed to write action: {e}") from e

        latency_ms = (time.perf_counter() - start_time) * 1000

        # Log warning if latency exceeds threshold (100ms)
        if latency_ms > 100:
            # In production, this would use proper logging
            pass  # TODO: Add logging when logging module is integrated

        return action.id

    def log_tool_call(
        self,
        tool_name: str,
        trigger: str,
        solution: str,
        result: str = "success",
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Convenience method to log a tool call action.

        Args:
            tool_name: Name of the tool that was called
            trigger: What triggered this tool call
            solution: What the tool did or returned
            result: Result status ('success', 'failure', or 'partial')
            context: Optional additional context

        Returns:
            The action ID
        """
        ctx = context or {}
        ctx["tool_name"] = tool_name
        ctx["tools_used"] = ctx.get("tools_used", [tool_name])

        # Map string result to ActionResult enum
        result_enum = self._parse_result(result)

        action = create_action(
            action_type=ActionType.TOOL_CALL,
            trigger=trigger,
            solution=solution,
            result=result_enum,
            context=ctx,
        )

        return self.log_action(action)

    def log_message(
        self,
        trigger: str,
        solution: str,
        result: str = "success",
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Convenience method to log a message action.

        Args:
            trigger: What triggered this message (e.g., user question)
            solution: The message content or response
            result: Result status ('success', 'failure', or 'partial')
            context: Optional additional context

        Returns:
            The action ID
        """
        result_enum = self._parse_result(result)

        action = create_action(
            action_type=ActionType.MESSAGE,
            trigger=trigger,
            solution=solution,
            result=result_enum,
            context=context or {},
        )

        return self.log_action(action)

    def log_message_structured(self, log: MessageLog) -> str:
        """
        Log a message with structured conversation details.

        This method provides a convenient way to record messages with
        detailed information including user input, agent response,
        token usage, and model info.

        Messages longer than 10KB are automatically truncated.

        Args:
            log: The MessageLog entry

        Returns:
            The action ID

        Example:
            logger.log_message_structured(MessageLog(
                user_message='What is the capital of France?',
                agent_message='The capital of France is Paris.',
                tokens_used=25,
                model='claude-3-opus'
            ))
        """
        MAX_MESSAGE_SIZE = 10000  # 10KB limit

        def truncate_message(msg: str) -> str:
            if len(msg) > MAX_MESSAGE_SIZE:
                return msg[:MAX_MESSAGE_SIZE] + '...[truncated]'
            return msg

        ctx: Dict[str, Any] = {
            "user_message": truncate_message(log.user_message),
            "agent_message": truncate_message(log.agent_message),
        }

        # Merge additional context
        if log.context:
            ctx.update(log.context)

        # Add optional fields
        if log.tokens_used is not None:
            ctx["tokens_used"] = log.tokens_used
        if log.model is not None:
            ctx["model"] = log.model

        # Determine result status
        result_enum = self._parse_result(log.result)

        # Create trigger and solution from message info
        trigger = f"User: {truncate_message(log.user_message[:100])}"
        solution = f"Agent: {truncate_message(log.agent_message[:100])}"

        action = create_action(
            action_type=ActionType.MESSAGE,
            trigger=trigger,
            solution=solution,
            result=result_enum,
            context=ctx,
        )

        return self.log_action(action)

    def log_decision(
        self,
        trigger: str,
        solution: str,
        result: str = "success",
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Convenience method to log a decision action.

        Args:
            trigger: What triggered this decision
            solution: The decision that was made
            result: Result status ('success', 'failure', or 'partial')
            context: Optional additional context

        Returns:
            The action ID
        """
        result_enum = self._parse_result(result)

        action = create_action(
            action_type=ActionType.DECISION,
            trigger=trigger,
            solution=solution,
            result=result_enum,
            context=context or {},
        )

        return self.log_action(action)

    def get_action(self, action_id: str) -> Optional[AgentAction]:
        """
        Get an action from the current session by ID.

        Args:
            action_id: The action ID to look up

        Returns:
            The AgentAction if found, None otherwise
        """
        session_id = self._recorder.get_active_session()
        if not session_id:
            return None

        session = self._recorder.get_session(session_id)
        if not session:
            return None

        # Search through actions in the session
        for action in session.actions:
            if action.id == action_id:
                return action

        return None

    def update_action(
        self,
        action_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """
        Update an existing action.

        This is primarily used for adding feedback to actions.

        Args:
            action_id: The ID of the action to update
            updates: Dictionary of fields to update

        Returns:
            True if the action was found and updated, False otherwise

        Note:
            This method modifies the session in memory. The changes are
            persisted when the session is ended.
        """
        session_id = self._recorder.get_active_session()
        if not session_id:
            return False

        session = self._recorder.get_session(session_id)
        if not session:
            return False

        # Find and update the action
        for i, action in enumerate(session.actions):
            if action.id == action_id:
                # Update allowed fields
                if "trigger" in updates:
                    action.trigger = updates["trigger"]
                if "solution" in updates:
                    action.solution = updates["solution"]
                if "result" in updates:
                    action.result = self._parse_result(updates["result"])
                if "context" in updates:
                    action.context.update(updates["context"])
                if "feedback" in updates:
                    action.feedback = updates["feedback"]

                return True

        return False

    def get_action_count(self) -> int:
        """
        Get the count of actions in the current session.

        Returns:
            Number of actions, or 0 if no active session
        """
        session_id = self._recorder.get_active_session()
        if not session_id:
            return 0

        session = self._recorder.get_session(session_id)
        if not session:
            return 0

        return len(session.actions)

    def _parse_result(self, result: str) -> ActionResult:
        """
        Parse a result string into an ActionResult enum.

        Args:
            result: Result string ('success', 'failure', 'partial')

        Returns:
            ActionResult enum value
        """
        result_map = {
            "success": ActionResult.SUCCESS,
            "failure": ActionResult.FAILURE,
            "partial": ActionResult.PARTIAL,
        }

        result_lower = result.lower()
        if result_lower not in result_map:
            raise ValueError(
                f"Invalid result: {result}. "
                f"Must be one of: {list(result_map.keys())}"
            )

        return result_map[result_lower]