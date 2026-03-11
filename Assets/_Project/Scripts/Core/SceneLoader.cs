using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Apex.Core
{
    /// <summary>
    /// Async scene loading with fade transition.
    /// </summary>
    public class SceneLoader : SingletonMonoBehaviour<SceneLoader>
    {
        public static event Action<string> OnSceneLoadStarted;
        public static event Action<float> OnSceneLoadProgress;
        public static event Action<string> OnSceneLoadCompleted;

        [SerializeField] private float _fadeDuration = 0.5f;
        [SerializeField] private CanvasGroup _fadeCanvasGroup;

        public bool IsLoading { get; private set; }

        /// <summary>
        /// Load a scene asynchronously with fade transition.
        /// </summary>
        public void LoadSceneAsync(string sceneName, Action onComplete = null)
        {
            if (IsLoading)
            {
                Debug.LogWarning($"[SceneLoader] Already loading a scene. Ignoring request for '{sceneName}'.");
                return;
            }

            StartCoroutine(LoadSceneCoroutine(sceneName, onComplete));
        }

        private IEnumerator LoadSceneCoroutine(string sceneName, Action onComplete)
        {
            IsLoading = true;
            OnSceneLoadStarted?.Invoke(sceneName);

            // Fade out
            yield return FadeCoroutine(1f);

            // Load scene
            var asyncOp = SceneManager.LoadSceneAsync(sceneName);
            if (asyncOp == null)
            {
                Debug.LogError($"[SceneLoader] Failed to load scene '{sceneName}'.");
                IsLoading = false;
                yield return FadeCoroutine(0f);
                yield break;
            }

            asyncOp.allowSceneActivation = false;

            while (asyncOp.progress < 0.9f)
            {
                OnSceneLoadProgress?.Invoke(asyncOp.progress);
                yield return null;
            }

            asyncOp.allowSceneActivation = true;

            // Wait for activation
            while (!asyncOp.isDone)
                yield return null;

            OnSceneLoadCompleted?.Invoke(sceneName);

            // Fade in
            yield return FadeCoroutine(0f);

            IsLoading = false;
            onComplete?.Invoke();
        }

        private IEnumerator FadeCoroutine(float targetAlpha)
        {
            if (_fadeCanvasGroup == null) yield break;

            float startAlpha = _fadeCanvasGroup.alpha;
            float elapsed = 0f;

            while (elapsed < _fadeDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                _fadeCanvasGroup.alpha = Mathf.Lerp(startAlpha, targetAlpha, elapsed / _fadeDuration);
                yield return null;
            }

            _fadeCanvasGroup.alpha = targetAlpha;
        }
    }
}
