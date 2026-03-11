using UnityEngine;

namespace Apex.UI
{
    /// <summary>
    /// Leaderboard display. Pulls data from Supabase in production.
    /// Placeholder implementation for Phase 1.
    /// </summary>
    public class LeaderboardUI : MonoBehaviour
    {
        [SerializeField] private Transform _entriesContainer;
        [SerializeField] private GameObject _entryPrefab;
        [SerializeField] private CanvasGroup _canvasGroup;

        /// <summary>
        /// Show the leaderboard.
        /// </summary>
        public void Show()
        {
            gameObject.SetActive(true);
            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = 1f;
                _canvasGroup.interactable = true;
                _canvasGroup.blocksRaycasts = true;
            }

            // TODO(phase2): Fetch from Supabase
            Debug.Log("[Leaderboard] Shown (placeholder).");
        }

        /// <summary>
        /// Hide the leaderboard.
        /// </summary>
        public void Hide()
        {
            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = 0f;
                _canvasGroup.interactable = false;
                _canvasGroup.blocksRaycasts = false;
            }

            gameObject.SetActive(false);
        }
    }
}
