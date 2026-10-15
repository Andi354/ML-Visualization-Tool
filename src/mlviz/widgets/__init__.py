"""Widgets: catalog and data. Importing the modules registers their widgets."""

from . import combination  # noqa: F401
from .registry import REGISTRY, catalog, compute

__all__ = ["REGISTRY", "catalog", "compute"]
