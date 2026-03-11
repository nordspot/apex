using System;
using UnityEngine;

namespace Apex.Characters
{
    /// <summary>
    /// Handles MEMO-9's interaction with world objects.
    /// Detects interactables in range, highlights them, and triggers interaction on input.
    /// </summary>
    public class Memo9Interaction : MonoBehaviour
    {
        public static event Action<IInteractable> OnInteractableInRange;
        public static event Action OnInteractableOutOfRange;
        public static event Action<IInteractable> OnInteracted;

        [SerializeField] private float _interactionRadius = 2f;
        [SerializeField] private LayerMask _interactableLayer;
        [SerializeField] private Transform _interactionPoint;

        private IInteractable _currentTarget;
        private readonly Collider[] _overlapResults = new Collider[8];

        private void Update()
        {
            ScanForInteractables();
        }

        /// <summary>
        /// Attempt to interact with the current target.
        /// Called by input system or tap handler.
        /// </summary>
        public void TryInteract()
        {
            if (_currentTarget == null) return;
            if (!_currentTarget.CanInteract) return;

            _currentTarget.Interact(this);
            OnInteracted?.Invoke(_currentTarget);
        }

        /// <summary>
        /// Force-interact with a specific object (e.g., from puzzle controller).
        /// </summary>
        public void InteractWith(IInteractable target)
        {
            target?.Interact(this);
            OnInteracted?.Invoke(target);
        }

        private void ScanForInteractables()
        {
            Vector3 scanCenter = _interactionPoint != null ? _interactionPoint.position : transform.position;
            int count = Physics.OverlapSphereNonAlloc(scanCenter, _interactionRadius, _overlapResults, _interactableLayer);

            IInteractable closest = null;
            float closestDist = float.MaxValue;

            for (int i = 0; i < count; i++)
            {
                if (_overlapResults[i].TryGetComponent<IInteractable>(out var interactable))
                {
                    if (!interactable.CanInteract) continue;

                    float dist = Vector3.Distance(scanCenter, _overlapResults[i].transform.position);
                    if (dist < closestDist)
                    {
                        closest = interactable;
                        closestDist = dist;
                    }
                }
            }

            if (closest != _currentTarget)
            {
                if (_currentTarget != null)
                {
                    _currentTarget.OnHighlightEnd();
                    OnInteractableOutOfRange?.Invoke();
                }

                _currentTarget = closest;

                if (_currentTarget != null)
                {
                    _currentTarget.OnHighlightBegin();
                    OnInteractableInRange?.Invoke(_currentTarget);
                }
            }
        }

        private void OnDrawGizmosSelected()
        {
            Vector3 center = _interactionPoint != null ? _interactionPoint.position : transform.position;
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireSphere(center, _interactionRadius);
        }
    }

    /// <summary>
    /// Interface for all objects MEMO-9 can interact with.
    /// </summary>
    public interface IInteractable
    {
        bool CanInteract { get; }
        string InteractionPromptKey { get; }
        void Interact(Memo9Interaction interactor);
        void OnHighlightBegin();
        void OnHighlightEnd();
    }
}
