using UnityEngine;
using Apex.Core;

namespace Apex.Managers
{
    /// <summary>
    /// Auto-detects device tier and applies quality settings.
    /// </summary>
    public class QualityManager : SingletonMonoBehaviour<QualityManager>
    {
        public enum QualityTier { Low, Medium, High }

        public QualityTier CurrentTier { get; private set; }

        protected override void OnInitialize()
        {
            CurrentTier = DeviceProfiler.DetectTier();
            ApplyQualitySettings(CurrentTier);
            Debug.Log($"[QualityManager] Device tier: {CurrentTier}");
        }

        /// <summary>
        /// Manually set quality tier (for settings menu).
        /// </summary>
        public void SetQualityTier(QualityTier tier)
        {
            CurrentTier = tier;
            ApplyQualitySettings(tier);
        }

        private void ApplyQualitySettings(QualityTier tier)
        {
            int qualityIndex = tier switch
            {
                QualityTier.Low => 0,
                QualityTier.Medium => 1,
                QualityTier.High => 2,
                _ => 1
            };

            QualitySettings.SetQualityLevel(qualityIndex, true);

            // Frame rate targets
            Application.targetFrameRate = tier == QualityTier.Low ? 30 : 60;

            Debug.Log($"[QualityManager] Applied quality level {qualityIndex} ({tier}), target FPS: {Application.targetFrameRate}");
        }
    }
}
