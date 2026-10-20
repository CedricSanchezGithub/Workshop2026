"""Contrat d'alerte détecteur → moteur (docs/architecture/contrat-alerte-remediation.md)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

IncidentType = Literal["dos", "sqli"]


class Alert(BaseModel):
    id: str = Field(min_length=8, max_length=64)
    ts: datetime
    event: Literal["alert", "resolved"] = "alert"
    type: IncidentType
    family: Literal["traffic", "injection"]
    score: float
    threshold: float
    target: str = Field(default="payment-api", max_length=64)
    offenders: list[str] = Field(default_factory=list, max_length=20)
    top_features: dict[str, float] = Field(default_factory=dict, max_length=30)
    window_s: int = 60
