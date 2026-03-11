using System;
using UnityEngine;
using UnityEngine.Video;
using Apex.Managers;

namespace Apex.UI
{
    /// <summary>
    /// Fullscreen Knowledge Clip video player with subtitle support.
    /// Always skippable — never mandatory.
    /// </summary>
    public class KnowledgeClipPlayer : MonoBehaviour
    {
        public static event Action<int> OnClipStarted;
        public static event Action<int> OnClipCompleted;
        public static event Action<int> OnClipSkipped;

        [SerializeField] private VideoPlayer _videoPlayer;
        [SerializeField] private CanvasGroup _playerCanvas;
        [SerializeField] private GameObject _skipButton;
        [SerializeField] private TMPro.TMP_Text _subtitleText;

        private int _currentClipIndex;
        private bool _isPlaying;
        private GameManager.GameState _previousState;

        private void Awake()
        {
            if (_videoPlayer != null)
                _videoPlayer.loopPointReached += HandleClipEnded;

            gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (_videoPlayer != null)
                _videoPlayer.loopPointReached -= HandleClipEnded;
        }

        /// <summary>
        /// Play a Knowledge Clip by index.
        /// </summary>
        public void PlayClip(int clipIndex, VideoClip clip)
        {
            if (_isPlaying) return;

            _currentClipIndex = clipIndex;
            _isPlaying = true;
            _previousState = GameManager.Instance.CurrentState;

            gameObject.SetActive(true);
            _videoPlayer.clip = clip;
            _videoPlayer.Play();

            if (_playerCanvas != null)
            {
                _playerCanvas.alpha = 1f;
                _playerCanvas.interactable = true;
                _playerCanvas.blocksRaycasts = true;
            }

            GameManager.Instance.SetState(GameManager.GameState.KnowledgeClip);
            OnClipStarted?.Invoke(clipIndex);
        }

        /// <summary>
        /// Skip the currently playing clip. Always allowed.
        /// </summary>
        public void SkipClip()
        {
            if (!_isPlaying) return;

            _videoPlayer.Stop();
            ClosePlayer();

            OnClipSkipped?.Invoke(_currentClipIndex);
            AnalyticsManager.Instance?.TrackEvent(AnalyticsManager.EventType.KnowledgeClipSkipped,
                new System.Collections.Generic.Dictionary<string, object> { { "clip_index", _currentClipIndex } });
        }

        private void HandleClipEnded(VideoPlayer source)
        {
            ClosePlayer();

            PlayerDataManager.Instance?.WatchKnowledgeClip(_currentClipIndex);
            OnClipCompleted?.Invoke(_currentClipIndex);
            AnalyticsManager.Instance?.TrackEvent(AnalyticsManager.EventType.KnowledgeClipCompleted,
                new System.Collections.Generic.Dictionary<string, object> { { "clip_index", _currentClipIndex } });
        }

        private void ClosePlayer()
        {
            _isPlaying = false;
            gameObject.SetActive(false);

            GameManager.Instance.SetState(_previousState);
        }
    }
}
