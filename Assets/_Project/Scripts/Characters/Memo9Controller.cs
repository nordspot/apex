using UnityEngine;
using UnityEngine.InputSystem;

namespace Apex.Characters
{
    /// <summary>
    /// MEMO-9 player movement controller.
    /// Supports joystick/WASD input and tap-to-move via NavMesh pathfinding.
    /// Root motion is OFF — movement is script-driven.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class Memo9Controller : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float _moveSpeed = 5f;
        [SerializeField] private float _rotationSpeed = 720f;
        [SerializeField] private float _gravity = -15f;
        [SerializeField] private float _groundCheckDistance = 0.2f;
        [SerializeField] private LayerMask _groundLayer;

        [Header("Tap-to-Move")]
        [SerializeField] private float _tapMoveStopDistance = 0.3f;
        [SerializeField] private LayerMask _tapMoveLayer;

        [Header("References")]
        [SerializeField] private Transform _cameraTransform;

        private CharacterController _characterController;
        private Vector2 _moveInput;
        private Vector3 _velocity;
        private Vector3 _tapMoveTarget;
        private bool _isTapMoving;
        private bool _isMovementEnabled = true;

        public bool IsMoving { get; private set; }
        public Vector3 MoveDirection { get; private set; }

        private void Awake()
        {
            _characterController = GetComponent<CharacterController>();
        }

        private void Start()
        {
            if (_cameraTransform == null)
            {
                var cam = Camera.main;
                if (cam != null) _cameraTransform = cam.transform;
            }
        }

        private void Update()
        {
            if (!_isMovementEnabled)
            {
                IsMoving = false;
                return;
            }

            HandleGravity();

            if (_isTapMoving)
                UpdateTapMove();
            else
                UpdateDirectMove();
        }

        /// <summary>
        /// Called by Input System PlayerInput component.
        /// </summary>
        public void OnMove(InputAction.CallbackContext context)
        {
            _moveInput = context.ReadValue<Vector2>();

            // Cancel tap-to-move when stick/keys are used
            if (_moveInput.sqrMagnitude > 0.01f)
                _isTapMoving = false;
        }

        /// <summary>
        /// Called by Input System for tap/click.
        /// </summary>
        public void OnTap(InputAction.CallbackContext context)
        {
            if (!context.performed) return;
            // TapPosition handled separately
        }

        /// <summary>
        /// Set tap-to-move destination from screen position.
        /// </summary>
        public void SetTapMoveTarget(Vector2 screenPosition)
        {
            var cam = Camera.main;
            if (cam == null) return;

            var ray = cam.ScreenPointToRay(screenPosition);
            if (Physics.Raycast(ray, out var hit, 100f, _tapMoveLayer))
            {
                _tapMoveTarget = hit.point;
                _isTapMoving = true;
            }
        }

        /// <summary>
        /// Enable or disable player movement (e.g., during puzzles, cutscenes).
        /// </summary>
        public void SetMovementEnabled(bool enabled)
        {
            _isMovementEnabled = enabled;
            if (!enabled)
            {
                _isTapMoving = false;
                _moveInput = Vector2.zero;
                IsMoving = false;
            }
        }

        private void UpdateDirectMove()
        {
            Vector3 move = Vector3.zero;

            if (_moveInput.sqrMagnitude > 0.01f && _cameraTransform != null)
            {
                // Camera-relative movement
                Vector3 camForward = _cameraTransform.forward;
                Vector3 camRight = _cameraTransform.right;
                camForward.y = 0f;
                camRight.y = 0f;
                camForward.Normalize();
                camRight.Normalize();

                move = camForward * _moveInput.y + camRight * _moveInput.x;
                move = Vector3.ClampMagnitude(move, 1f);
            }

            ApplyMovement(move);
        }

        private void UpdateTapMove()
        {
            Vector3 toTarget = _tapMoveTarget - transform.position;
            toTarget.y = 0f;

            if (toTarget.magnitude < _tapMoveStopDistance)
            {
                _isTapMoving = false;
                ApplyMovement(Vector3.zero);
                return;
            }

            ApplyMovement(toTarget.normalized);
        }

        private void ApplyMovement(Vector3 direction)
        {
            MoveDirection = direction;
            IsMoving = direction.sqrMagnitude > 0.01f;

            if (IsMoving)
            {
                // Rotate toward movement direction
                Quaternion targetRotation = Quaternion.LookRotation(direction);
                transform.rotation = Quaternion.RotateTowards(
                    transform.rotation, targetRotation, _rotationSpeed * Time.deltaTime);
            }

            Vector3 move = direction * _moveSpeed;
            move.y = _velocity.y;

            _characterController.Move(move * Time.deltaTime);
        }

        private void HandleGravity()
        {
            if (_characterController.isGrounded && _velocity.y < 0f)
                _velocity.y = -2f;
            else
                _velocity.y += _gravity * Time.deltaTime;
        }
    }
}
