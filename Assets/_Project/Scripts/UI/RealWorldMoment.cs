using System;
using UnityEngine;
using Apex.Managers;

namespace Apex.UI
{
    /// <summary>
    /// Real-World Moment: opens a web URL or in-game content for career exploration.
    /// Always skippable — completion is tracked but never required.
    /// </summary>
    public class RealWorldMoment : MonoBehaviour
    {
        public static event Action<string> OnMomentCompleted;
        public static event Action<string> OnMomentSkipped;

        [SerializeField] private string _momentId;
        [SerializeField] private string _url;
        [SerializeField] private CanvasGroup _overlayCanvas;

        /// <summary>
        /// Open the Real-World Moment.
        /// </summary>
        public void Open()
        {
            GameManager.Instance.SetState(GameManager.GameState.RealWorldMoment);

            if (!string.IsNullOrEmpty(_url))
                Application.OpenURL(_url);

            if (_overlayCanvas != null)
            {
                _overlayCanvas.alpha = 1f;
                _overlayCanvas.interactable = true;
                _overlayCanvas.blocksRaycasts = true;
            }
        }

        /// <summary>
        /// Mark as completed (player returned from external content).
        /// </summary>
        public void Complete()
        {
            Close();
            OnMomentCompleted?.Invoke(_momentId);
            AnalyticsManager.Instance?.TrackEvent(AnalyticsManager.EventType.RealWorldMomentCompleted,
                new System.Collections.Generic.Dictionary<string, object> { { "moment_id", _momentId } });
        }

        /// <summary>
        /// Skip the moment.
        /// </summary>
        public void Skip()
        {
            Close();
            OnMomentSkipped?.Invoke(_momentId);
            AnalyticsManager.Instance?.TrackEvent(AnalyticsManager.EventType.RealWorldMomentSkipped,
                new System.Collections.Generic.Dictionary<string, object> { { "moment_id", _momentId } });
        }

        private void Close()
        {
            if (_overlayCanvas != null)
            {
                _overlayCanvas.alpha = 0f;
                _overlayCanvas.interactable = false;
                _overlayCanvas.blocksRaycasts = false;
            }

            GameManager.Instance.SetState(GameManager.GameState.Playing);
        }
    }
}
