using UnityEngine;
using Apex.Managers;

namespace Apex.UI
{
    /// <summary>
    /// Diegetic holographic UI projected from MEMO-9.
    /// Floats in world space, always faces camera, with scan-line wobble.
    /// </summary>
    public class HolographicUI : MonoBehaviour
    {
        [Header("Positioning")]
        [SerializeField] private Transform _projectionAnchor;
        [SerializeField] private float _floatHeight = 0.3f;
        [SerializeField] private float _floatAmplitude = 0.02f;
        [SerializeField] private float _floatFrequency = 1.5f;

        [Header("Appearance")]
        [SerializeField] private CanvasGroup _canvasGroup;
        [SerializeField] private float _fadeSpeed = 3f;

        private Transform _cameraTransform;
        private bool _isVisible;
        private float _targetAlpha;

        private void Start()
        {
            var cam = Camera.main;
            if (cam != null) _cameraTransform = cam.transform;

            if (_canvasGroup != null)
                _canvasGroup.alpha = 0f;
        }

        private void LateUpdate()
        {
            if (_projectionAnchor != null)
            {
                float wobble = Mathf.Sin(Time.time * _floatFrequency) * _floatAmplitude;
                transform.position = _projectionAnchor.position + Vector3.up * (_floatHeight + wobble);
            }

            // Billboard: face camera
            if (_cameraTransform != null)
            {
                Vector3 lookDir = _cameraTransform.position - transform.position;
                lookDir.y = 0f;
                if (lookDir.sqrMagnitude > 0.01f)
                    transform.rotation = Quaternion.LookRotation(-lookDir);
            }

            // Fade
            if (_canvasGroup != null)
            {
                _canvasGroup.alpha = Mathf.MoveTowards(_canvasGroup.alpha, _targetAlpha, _fadeSpeed * Time.deltaTime);
                _canvasGroup.interactable = _canvasGroup.alpha > 0.5f;
                _canvasGroup.blocksRaycasts = _canvasGroup.alpha > 0.5f;
            }
        }

        /// <summary>
        /// Show the holographic UI.
        /// </summary>
        public void Show()
        {
            _isVisible = true;
            _targetAlpha = 1f;
        }

        /// <summary>
        /// Hide the holographic UI.
        /// </summary>
        public void Hide()
        {
            _isVisible = false;
            _targetAlpha = 0f;
        }

        /// <summary>
        /// Toggle visibility.
        /// </summary>
        public void Toggle()
        {
            if (_isVisible) Hide(); else Show();
        }
    }
}
