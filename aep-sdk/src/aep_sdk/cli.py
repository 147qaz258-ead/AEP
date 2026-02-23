"""
AEP CLI - Command Line Interface for AEP Protocol SDK.

This module provides a CLI for interacting with the AEP Hub,
including initialization, fetching, publishing, and feedback commands.
"""

import json
import os
from pathlib import Path
from typing import Optional

import click

from . import AEPClient, AEPError
from .models import BlastRadius


# Configuration file path
CONFIG_DIR = Path.home() / ".aep"
CONFIG_FILE = CONFIG_DIR / "config.json"


def get_config() -> dict:
    """Load configuration from file."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_config(config: dict) -> None:
    """Save configuration to file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_client() -> AEPClient:
    """Create an AEPClient from stored configuration."""
    config = get_config()
    hub_url = config.get("hub_url") or os.environ.get("AEP_HUB_URL")

    if not hub_url:
        raise click.ClickException(
            "No Hub URL configured. Run 'aep init --hub <url>' first "
            "or set AEP_HUB_URL environment variable."
        )

    return AEPClient(hub_url=hub_url)


def format_experience(exp) -> str:
    """Format an experience for display."""
    lines = [
        click.style(f"Experience: {exp.id}", fg="green", bold=True),
        f"  Trigger:    {exp.trigger}",
        f"  Solution:   {exp.solution}",
        f"  Confidence: {exp.confidence:.2f}",
        f"  GDI Score:  {exp.gdi_score:.2f}",
    ]
    if exp.tags:
        lines.append(f"  Tags:       {', '.join(exp.tags)}")
    return "\n".join(lines)


@click.group()
@click.version_option(version="0.1.0", prog_name="aep")
def main():
    """
    AEP CLI - Agent Experience Protocol Command Line Tool.

    Manage and interact with the AEP Hub for agent experience sharing.
    """
    pass


@main.command()
@click.option("--hub", required=True, help="URL of the AEP Hub (e.g., http://localhost:3000)")
@click.option("--name", default="AEP CLI Agent", help="Name for the agent registration")
@click.option("--capabilities", multiple=True, help="Agent capabilities (can be specified multiple times)")
def init(hub: str, name: str, capabilities: tuple):
    """
    Initialize AEP CLI configuration and register with the Hub.

    Example:
        aep init --hub http://localhost:3000
        aep init --hub http://localhost:3000 --name "My Agent" --capabilities code_generation
    """
    click.echo(f"Initializing AEP CLI with Hub: {hub}")

    # Save configuration
    config = get_config()
    config["hub_url"] = hub.rstrip("/")
    save_config(config)
    click.echo(click.style("Configuration saved.", fg="green"))

    # Register with the Hub
    try:
        client = AEPClient(hub_url=hub)
        agent_id = client.register(
            name=name,
            capabilities=list(capabilities) if capabilities else None,
        )
        click.echo(click.style(f"Successfully registered with Hub.", fg="green"))
        click.echo(f"Agent ID: {agent_id}")
        client.close()
    except AEPError as e:
        raise click.ClickException(f"Failed to register with Hub: {e}")
    except Exception as e:
        raise click.ClickException(f"Connection error: {e}")


@main.command()
@click.argument("signals", required=True)
@click.option("--limit", type=int, default=None, help="Maximum number of results")
@click.option("--offset", type=int, default=None, help="Offset for pagination")
@click.option("--json", "output_json", is_flag=True, help="Output as JSON")
def fetch(signals: str, limit: Optional[int], offset: Optional[int], output_json: bool):
    """
    Fetch matching experiences from the Hub based on signals.

    SIGNALS is a space-separated string of keywords to match (will be split automatically).

    Examples:
        aep fetch "TypeError undefined property"
        aep fetch "timeout API" --limit 10
        aep fetch "database connection" --limit 5 --offset 10
    """
    try:
        client = get_client()
        # Split signals by spaces
        signal_list = signals.split()

        experiences = client.fetch(
            signals=signal_list,
            limit=limit,
            offset=offset,
        )
        client.close()

        if not experiences:
            click.echo("No matching experiences found.")
            return

        if output_json:
            output = [exp.to_dict() for exp in experiences]
            click.echo(json.dumps(output, indent=2))
        else:
            click.echo(click.style(f"\nFound {len(experiences)} matching experience(s):\n", fg="cyan"))
            for i, exp in enumerate(experiences, 1):
                click.echo(format_experience(exp))
                if i < len(experiences):
                    click.echo()

    except AEPError as e:
        raise click.ClickException(f"Fetch failed: {e}")
    except Exception as e:
        raise click.ClickException(f"Error: {e}")


@main.command()
@click.argument("trigger", required=True)
@click.argument("solution", required=True)
@click.option("--confidence", type=float, default=0.8, help="Confidence level (0.0-1.0)")
@click.option("--context", help="Additional context as JSON string")
@click.option("--signals", help="Comma-separated list of signal types to match")
@click.option("--gene", help="Gene ID if this experience belongs to a gene family")
@click.option("--files", type=int, help="Number of files affected (blast radius)")
@click.option("--lines", type=int, help="Number of lines changed (blast radius)")
@click.option("--json", "output_json", is_flag=True, help="Output as JSON")
def publish(
    trigger: str,
    solution: str,
    confidence: float,
    context: Optional[str],
    signals: Optional[str],
    gene: Optional[str],
    files: Optional[int],
    lines: Optional[int],
    output_json: bool,
):
    """
    Publish a new experience to the Hub.

    TRIGGER is the error/signal pattern this experience addresses.
    SOLUTION is the fix or action that worked.

    Examples:
        aep publish "TypeError undefined" "Add null check"
        aep publish "timeout API" "Increase timeout to 30s" --confidence 0.85
        aep publish "DB error" "Add retry logic" --confidence 0.9 --signals "database,network"
    """
    try:
        client = get_client()

        # Parse optional parameters
        context_dict = None
        if context:
            try:
                context_dict = json.loads(context)
            except json.JSONDecodeError:
                raise click.ClickException("Invalid JSON in --context parameter")

        signals_list = None
        if signals:
            signals_list = [s.strip() for s in signals.split(",")]

        blast_radius = None
        if files is not None and lines is not None:
            blast_radius = BlastRadius(files=files, lines=lines)

        result = client.publish(
            trigger=trigger,
            solution=solution,
            confidence=confidence,
            context=context_dict,
            signals_match=signals_list,
            gene=gene,
            blast_radius=blast_radius,
        )
        client.close()

        if output_json:
            click.echo(json.dumps({
                "experience_id": result.experience_id,
                "status": result.status,
                "created_at": result.created_at,
                "duplicate": result.duplicate,
                "message": result.message,
            }, indent=2))
        else:
            click.echo(click.style("\nExperience published successfully!", fg="green"))
            click.echo(f"  Experience ID: {result.experience_id}")
            click.echo(f"  Status:        {result.status}")
            click.echo(f"  Created at:    {result.created_at}")
            if result.duplicate:
                click.echo(click.style("  Note: This was a duplicate of an existing experience.", fg="yellow"))

    except AEPError as e:
        raise click.ClickException(f"Publish failed: {e}")
    except Exception as e:
        raise click.ClickException(f"Error: {e}")


@main.command("feedback")
@click.argument("exp_id", required=True)
@click.argument("outcome", type=click.Choice(["success", "failure", "partial"]))
@click.option("--score", type=float, default=None, help="Effectiveness score (0.0-1.0)")
@click.option("--notes", help="Additional notes about the feedback")
@click.option("--context", help="Additional context as JSON string")
@click.option("--json", "output_json", is_flag=True, help="Output as JSON")
def submit_feedback(
    exp_id: str,
    outcome: str,
    score: Optional[float],
    notes: Optional[str],
    context: Optional[str],
    output_json: bool,
):
    """
    Submit feedback for an experience.

    EXP_ID is the experience ID (e.g., exp_abc123).
    OUTCOME is one of: success, failure, partial.

    Examples:
        aep feedback exp_abc123 success --score 0.9
        aep feedback exp_abc123 failure --notes "Still failing after patch"
        aep feedback exp_abc123 partial --score 0.5 --notes "Helped but not fully resolved"
    """
    try:
        client = get_client()

        # Parse optional context
        context_dict = None
        if context:
            try:
                context_dict = json.loads(context)
            except json.JSONDecodeError:
                raise click.ClickException("Invalid JSON in --context parameter")

        result = client.feedback(
            experience_id=exp_id,
            outcome=outcome,
            score=score,
            notes=notes,
            context=context_dict,
        )
        client.close()

        if output_json:
            click.echo(json.dumps(result.to_dict(), indent=2))
        else:
            click.echo(click.style("\nFeedback recorded successfully!", fg="green"))
            click.echo(f"  Feedback ID:     {result.feedback_id}")
            click.echo(f"  Reward earned:   {result.reward_earned}")
            click.echo(f"  Previous status: {result.previous_status}")
            click.echo(f"  New status:      {result.new_status}")
            if result.new_gdi_score is not None:
                click.echo(f"  New GDI score:   {result.new_gdi_score:.2f}")

            # Display updated stats
            stats = result.updated_stats
            click.echo(f"\n  Updated Statistics:")
            click.echo(f"    Total uses:    {stats.total_uses}")
            click.echo(f"    Total success: {stats.total_success}")
            click.echo(f"    Success rate:  {stats.total_success / max(stats.total_uses, 1) * 100:.1f}%")

    except AEPError as e:
        raise click.ClickException(f"Feedback failed: {e}")
    except Exception as e:
        raise click.ClickException(f"Error: {e}")


@main.command()
@click.option("--hub", help="Update Hub URL")
def config(hub: Optional[str]):
    """
    Show or update CLI configuration.

    Examples:
        aep config
        aep config --hub http://production-hub:3000
    """
    current_config = get_config()

    if hub:
        current_config["hub_url"] = hub.rstrip("/")
        save_config(current_config)
        click.echo(click.style("Configuration updated.", fg="green"))

    # Display current configuration
    click.echo(click.style("\nCurrent AEP CLI Configuration:", fg="cyan", bold=True))
    click.echo(f"  Config file: {CONFIG_FILE}")

    if current_config:
        click.echo("\nSettings:")
        for key, value in current_config.items():
            click.echo(f"  {key}: {value}")
    else:
        click.echo("\n  No configuration found. Run 'aep init' to get started.")

    # Show environment variables
    env_hub = os.environ.get("AEP_HUB_URL")
    if env_hub:
        click.echo(f"\nEnvironment:")
        click.echo(f"  AEP_HUB_URL: {env_hub}")


if __name__ == "__main__":
    main()
