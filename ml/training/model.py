"""Modèle de détection par famille de signaux (partagé entre l'entraînement et l'inférence).

Deux composantes non supervisées, apprises UNIQUEMENT sur du trafic normal :

1. IsolationForest sur les features transformées (log1p + mise à l'échelle robuste) : repère les
   combinaisons inhabituelles de signaux.
2. Enveloppe statistique par feature (z-score robuste, seuil appris sur le normal) : repère une
   valeur hors de tout ce qui a été observé. Nécessaire car une Isolation Forest ne découpe qu'à
   l'intérieur de la plage vue à l'entraînement : une feature toujours nulle en normal (ex. règles
   CRS SQLi) ne pèse pas dans ses arbres, et un point très loin hors plage n'est pas isolé plus vite
   que le point normal le plus extrême.

Une fenêtre est anormale si l'une des deux composantes la juge anormale. Aucune règle écrite à la
main : les seuils sont des quantiles / maxima mesurés sur les données normales.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


@dataclass
class FamilyModel:
    family: str
    incident_type: str
    features: list[str]
    center: np.ndarray = field(repr=False, default=None)
    scale: np.ndarray = field(repr=False, default=None)
    forest: IsolationForest = field(repr=False, default=None)
    if_threshold: float = 0.0       # score IF (decision_function) sous lequel la fenêtre est anormale
    z_threshold: np.ndarray = field(repr=False, default=None)  # par feature
    trained_on: int = 0

    # --- Transformations -------------------------------------------------------------------
    def _transform(self, X: pd.DataFrame) -> np.ndarray:
        return np.log1p(np.clip(X[self.features].to_numpy(dtype=float), 0, None))

    def _z(self, T: np.ndarray) -> np.ndarray:
        return (T - self.center) / self.scale

    # --- Apprentissage ---------------------------------------------------------------------
    def fit(self, normal: pd.DataFrame, fp_quantile: float = 0.002, z_margin: float = 1.5,
            z_floor: float = 6.0, seed: int = 42) -> "FamilyModel":
        T = self._transform(normal)
        self.center = np.median(T, axis=0)
        mad = np.median(np.abs(T - self.center), axis=0) * 1.4826
        # Plancher d'échelle : une feature constante en normal (MAD = 0) reste comparable aux autres
        # (sinon division par zéro, ou un écart minuscule deviendrait infini).
        self.scale = np.maximum(mad, np.maximum(0.05 * np.abs(self.center), 0.05))
        Z = self._z(T)
        self.forest = IsolationForest(n_estimators=300, contamination="auto", random_state=seed).fit(Z)
        scores = self.forest.decision_function(Z)
        self.if_threshold = float(np.quantile(scores, fp_quantile))
        self.z_threshold = np.maximum(np.abs(Z).max(axis=0) * z_margin, z_floor)
        self.trained_on = len(normal)
        return self

    # --- Décision --------------------------------------------------------------------------
    def score(self, X: pd.DataFrame) -> pd.DataFrame:
        Z = self._z(self._transform(X))
        if_score = self.forest.decision_function(Z)
        z_ratio = np.abs(Z) / self.z_threshold  # > 1 : feature hors enveloppe
        worst = z_ratio.argmax(axis=1)
        return pd.DataFrame({
            "if_score": if_score,
            "if_anomaly": if_score < self.if_threshold,
            "z_max_ratio": z_ratio.max(axis=1),
            "z_anomaly": z_ratio.max(axis=1) > 1,
            "worst_feature": [self.features[i] for i in worst],
        }, index=X.index).assign(anomaly=lambda d: d.if_anomaly | d.z_anomaly)

    def explain(self, row: pd.Series, top: int = 4) -> dict[str, float]:
        """Features les plus éloignées de la normale (valeurs brutes), pour l'alerte et le dashboard."""
        Z = self._z(self._transform(row.to_frame().T))[0]
        order = np.argsort(-np.abs(Z / self.z_threshold))[:top]
        return {self.features[i]: round(float(row[self.features[i]]), 4) for i in order}
