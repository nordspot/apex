using System;
using System.Collections.Generic;

namespace Apex.Data
{
    /// <summary>
    /// Analytics event data structure for batched dispatch.
    /// </summary>
    [Serializable]
    public class AnalyticsEvent
    {
        public string eventType;
        public long timestampUnixMs;
        public Dictionary<string, object> parameters = new();
    }
}
