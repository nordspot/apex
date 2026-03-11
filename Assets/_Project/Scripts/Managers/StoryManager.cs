using System;
using System.Collections.Generic;
using UnityEngine;
using Apex.Core;

namespace Apex.Managers
{
    /// <summary>
    /// Tracks narrative progression: which story beats have played,
    /// which cutscenes have been seen, and triggers story events.
    /// </summary>
    public class StoryManager : SingletonMonoBehaviour<StoryManager>
    {
        public static event Action<string> OnStoryBeatTriggered;
        public static event Action<int> OnKnowledgeClipRequested;
        public static event Action<string> OnRealWorldMomentRequested;

        private readonly HashSet<string> _triggeredBeats = new();

        /// <summary>
        /// Trigger a named story beat. Only fires once per session unless reset.
        /// </summary>
        public void TriggerBeat(string beatId)
        {
            if (_triggeredBeats.Contains(beatId)) return;

            _triggeredBeats.Add(beatId);
            OnStoryBeatTriggered?.Invoke(beatId);
            Debug.Log($"[StoryManager] Beat triggered: {beatId}");
        }

        /// <summary>
        /// Request a Knowledge Clip to play.
        /// </summary>
        public void RequestKnowledgeClip(int clipIndex)
        {
            OnKnowledgeClipRequested?.Invoke(clipIndex);
            GameManager.Instance.SetState(GameManager.GameState.KnowledgeClip);
        }

        /// <summary>
        /// Request a Real-World Moment (opens URL or in-game content).
        /// </summary>
        public void RequestRealWorldMoment(string momentId)
        {
            OnRealWorldMomentRequested?.Invoke(momentId);
            GameManager.Instance.SetState(GameManager.GameState.RealWorldMoment);
        }

        /// <summary>
        /// Check if a story beat has been triggered this session.
        /// </summary>
        public bool HasTriggered(string beatId) => _triggeredBeats.Contains(beatId);

        /// <summary>
        /// Check if MEMO-9 can speak to humans (Level 7+ with comm module).
        /// </summary>
        public bool CanCommunicateWithHumans()
        {
            var data = PlayerDataManager.Instance?.Data;
            if (data == null) return false;

            return data.currentLevel >= 6 && data.acquiredUpgrades.Contains("comm_module");
        }
    }
}
