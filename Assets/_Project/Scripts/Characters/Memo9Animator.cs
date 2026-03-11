using UnityEngine;

namespace Apex.Characters
{
    /// <summary>
    /// Bridge between Memo9Controller state and the Animator.
    /// Drives animation parameters based on movement and interaction state.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class Memo9Animator : MonoBehaviour
    {
        private static readonly int AnimIsMoving = Animator.StringToHash("IsMoving");
        private static readonly int AnimMoveSpeed = Animator.StringToHash("MoveSpeed");
        private static readonly int AnimInteract = Animator.StringToHash("Interact");
        private static readonly int AnimCelebrate = Animator.StringToHash("Celebrate");
        private static readonly int AnimSad = Animator.StringToHash("Sad");
        private static readonly int AnimUpgrade = Animator.StringToHash("Upgrade");
        private static readonly int AnimState = Animator.StringToHash("State");

        [SerializeField] private Memo9Controller _controller;

        private Animator _animator;

        private void Awake()
        {
            _animator = GetComponent<Animator>();
            if (_controller == null)
                _controller = GetComponentInParent<Memo9Controller>();
        }

        private void Update()
        {
            if (_controller == null || _animator == null) return;

            _animator.SetBool(AnimIsMoving, _controller.IsMoving);
            _animator.SetFloat(AnimMoveSpeed, _controller.MoveDirection.magnitude);
        }

        /// <summary>
        /// Trigger the interaction animation.
        /// </summary>
        public void PlayInteract() => _animator.SetTrigger(AnimInteract);

        /// <summary>
        /// Trigger the celebration animation (puzzle solved).
        /// </summary>
        public void PlayCelebrate() => _animator.SetTrigger(AnimCelebrate);

        /// <summary>
        /// Trigger the sad animation (failed attempt — gentle, not punishing).
        /// </summary>
        public void PlaySad() => _animator.SetTrigger(AnimSad);

        /// <summary>
        /// Trigger the upgrade acquisition animation.
        /// </summary>
        public void PlayUpgrade() => _animator.SetTrigger(AnimUpgrade);

        /// <summary>
        /// Set the overall robot state (maps to RobotState enum integer).
        /// </summary>
        public void SetState(int stateIndex) => _animator.SetInteger(AnimState, stateIndex);
    }
}
