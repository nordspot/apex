using UnityEngine;
using UnityEngine.AI;

namespace Apex.Characters
{
    /// <summary>
    /// Dog companion AI behavior using NavMeshAgent.
    /// Follows MEMO-9, reacts to hints, and provides emotional presence.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class DogAI : MonoBehaviour
    {
        public enum DogState
        {
            Idle,
            Following,
            Sniffing,
            Barking,
            Sitting,
            Scared,
            Happy,
            Sleeping,
            Reunion
        }

        [Header("Follow Settings")]
        [SerializeField] private Transform _followTarget;
        [SerializeField] private float _followDistance = 2.5f;
        [SerializeField] private float _followOffset = 1f;
        [SerializeField] private float _stopDistance = 1.5f;

        [Header("Hint Response")]
        [SerializeField] private DogHintSystem _hintSystem;

        private NavMeshAgent _agent;
        private DogState _currentState = DogState.Idle;

        public DogState CurrentState => _currentState;

        private void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
            _agent.stoppingDistance = _stopDistance;
        }

        private void OnEnable()
        {
            DogHintSystem.OnHintStageTriggered += HandleHintStage;
        }

        private void OnDisable()
        {
            DogHintSystem.OnHintStageTriggered -= HandleHintStage;
        }

        private void Update()
        {
            switch (_currentState)
            {
                case DogState.Following:
                    UpdateFollowing();
                    break;
                case DogState.Idle:
                    UpdateIdle();
                    break;
                case DogState.Sniffing:
                case DogState.Barking:
                case DogState.Sitting:
                    UpdateHintBehavior();
                    break;
            }
        }

        /// <summary>
        /// Set the dog's behavior state.
        /// </summary>
        public void SetState(DogState state)
        {
            if (_currentState == state) return;
            _currentState = state;

            switch (state)
            {
                case DogState.Following:
                    _agent.isStopped = false;
                    break;
                case DogState.Idle:
                case DogState.Sleeping:
                    _agent.isStopped = true;
                    break;
                case DogState.Happy:
                    _agent.isStopped = true;
                    break;
            }
        }

        /// <summary>
        /// Set the target to follow (usually MEMO-9).
        /// </summary>
        public void SetFollowTarget(Transform target)
        {
            _followTarget = target;
            SetState(DogState.Following);
        }

        private void UpdateFollowing()
        {
            if (_followTarget == null) return;

            // Follow at an offset to the side
            Vector3 targetPos = _followTarget.position - _followTarget.right * _followOffset;
            float dist = Vector3.Distance(transform.position, targetPos);

            if (dist > _followDistance)
            {
                _agent.isStopped = false;
                _agent.SetDestination(targetPos);
            }
            else if (dist < _stopDistance)
            {
                _agent.isStopped = true;
            }
        }

        private void UpdateIdle()
        {
            // Look toward MEMO-9 when idle
            if (_followTarget == null) return;

            Vector3 lookDir = _followTarget.position - transform.position;
            lookDir.y = 0f;
            if (lookDir.sqrMagnitude > 0.01f)
            {
                Quaternion targetRot = Quaternion.LookRotation(lookDir);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.deltaTime * 2f);
            }
        }

        private void UpdateHintBehavior()
        {
            if (_hintSystem == null || _hintSystem.HintTarget == null) return;

            switch (_currentState)
            {
                case DogState.Sniffing:
                    // Move toward hint area, sniffing animation
                    Vector3 midpoint = Vector3.Lerp(transform.position, _hintSystem.HintTarget.position, 0.3f);
                    _agent.SetDestination(midpoint);
                    break;

                case DogState.Barking:
                    // Face the hint target, bark
                    _agent.isStopped = true;
                    Vector3 lookAt = _hintSystem.HintTarget.position - transform.position;
                    lookAt.y = 0f;
                    if (lookAt.sqrMagnitude > 0.01f)
                        transform.rotation = Quaternion.LookRotation(lookAt);
                    break;

                case DogState.Sitting:
                    // Move to exact hint position and sit
                    _agent.SetDestination(_hintSystem.HintTarget.position);
                    if (_agent.remainingDistance < 0.5f)
                        _agent.isStopped = true;
                    break;
            }
        }

        private void HandleHintStage(int stage)
        {
            switch (stage)
            {
                case 1: SetState(DogState.Sniffing); break;
                case 2: SetState(DogState.Barking); break;
                case 3: SetState(DogState.Sitting); break;
            }
        }
    }
}
