using UnityEngine;

namespace Apex.Characters
{
    /// <summary>
    /// Bridge between DogAI state and the Animator.
    /// </summary>
    [RequireComponent(typeof(Animator))]
    public class DogAnimator : MonoBehaviour
    {
        private static readonly int AnimState = Animator.StringToHash("State");
        private static readonly int AnimSpeed = Animator.StringToHash("Speed");

        [SerializeField] private DogAI _dogAI;

        private Animator _animator;
        private UnityEngine.AI.NavMeshAgent _agent;

        private void Awake()
        {
            _animator = GetComponent<Animator>();
            _agent = GetComponent<UnityEngine.AI.NavMeshAgent>();
            if (_dogAI == null)
                _dogAI = GetComponentInParent<DogAI>();
        }

        private void Update()
        {
            if (_dogAI == null || _animator == null) return;

            _animator.SetInteger(AnimState, (int)_dogAI.CurrentState);

            if (_agent != null)
                _animator.SetFloat(AnimSpeed, _agent.velocity.magnitude);
        }
    }
}
