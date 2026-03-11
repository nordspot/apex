using System;
using System.Collections.Generic;
using UnityEngine;
using Apex.Core;
using Apex.Data;

namespace Apex.Managers
{
    /// <summary>
    /// Tracks and dispatches analytics events.
    /// Currently logs locally; Supabase integration to be added.
    /// </summary>
    public class AnalyticsManager : SingletonMonoBehaviour<AnalyticsManager>
    {
        public enum EventType
        {
            SessionStart,
            SessionEnd,
            LevelStarted,
            LevelCompleted,
            PuzzleAttempt,
            PuzzleSolved,
            UpgradeAcquired,
            KnowledgeClipStarted,
            KnowledgeClipCompleted,
            KnowledgeClipSkipped,
            RealWorldMomentCompleted,
            RealWorldMomentSkipped,
            CustomizationChanged,
            SideQuestEntered,
            SideQuestCompleted,
            DogInteraction,
            HintTriggered
        }

        private readonly List<AnalyticsEvent> _eventQueue = new();
        private const int BatchSize = 10;

        protected override void OnInitialize()
        {
            TrackEvent(EventType.SessionStart);
        }

        /// <summary>
        /// Track an analytics event with optional parameters.
        /// </summary>
        public void TrackEvent(EventType eventType, Dictionary<string, object> parameters = null)
        {
            var evt = new AnalyticsEvent
            {
                eventType = eventType.ToString(),
                timestampUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                parameters = parameters ?? new Dictionary<string, object>()
            };

            // Add common context
            evt.parameters["session_id"] = PlayerDataManager.Instance?.Data?.uuid ?? "unknown";
            evt.parameters["level"] = GameManager.Instance?.CurrentLevel ?? -1;

            _eventQueue.Add(evt);
            Debug.Log($"[Analytics] {eventType} | params: {evt.parameters.Count}");

            if (_eventQueue.Count >= BatchSize)
                FlushEvents();
        }

        /// <summary>
        /// Track an aptitude signal from a puzzle completion.
        /// </summary>
        public void TrackAptitude(AptitudeSignal signal)
        {
            TrackEvent(EventType.PuzzleSolved, new Dictionary<string, object>
            {
                { "career_id", signal.careerId },
                { "accuracy", signal.accuracy },
                { "speed", signal.speed },
                { "attempts", signal.attempts },
                { "used_clip", signal.usedKnowledgeClip },
                { "hints_used", signal.hintsUsed }
            });

            PlayerDataManager.Instance?.RecordAptitude(signal);
        }

        /// <summary>
        /// Send queued events to backend. Currently logs only.
        /// </summary>
        public void FlushEvents()
        {
            if (_eventQueue.Count == 0) return;

            // TODO(phase2): Send to Supabase
            Debug.Log($"[Analytics] Flushing {_eventQueue.Count} events.");
            _eventQueue.Clear();
        }

        private void OnApplicationQuit()
        {
            TrackEvent(EventType.SessionEnd);
            FlushEvents();
        }

        private void OnApplicationPause(bool pause)
        {
            if (pause) FlushEvents();
        }
    }
}
