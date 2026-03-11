using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Apex.UI
{
    /// <summary>
    /// 9-axis radar chart for visualizing career aptitude scores.
    /// Renders as a filled polygon on a UI canvas.
    /// </summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public class RadarChart : Graphic
    {
        [SerializeField] private int _axisCount = 9;
        [SerializeField] private float _radius = 100f;
        [SerializeField] private float _lineWidth = 2f;
        [SerializeField] private Color _fillColor = new(0f, 0.898f, 1f, 0.3f);
        [SerializeField] private Color _outlineColor = new(0f, 0.898f, 1f, 1f);

        private readonly List<float> _values = new();

        /// <summary>
        /// Set aptitude values (0-1 range). Must match axis count.
        /// </summary>
        public void SetValues(List<float> values)
        {
            _values.Clear();
            _values.AddRange(values);

            while (_values.Count < _axisCount)
                _values.Add(0f);

            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();

            if (_values.Count < _axisCount) return;

            Vector2 center = Vector2.zero;
            float angleStep = 360f / _axisCount;

            // Center vertex
            vh.AddVert(center, _fillColor, Vector2.zero);

            // Outer vertices based on values
            for (int i = 0; i < _axisCount; i++)
            {
                float angle = (90f - i * angleStep) * Mathf.Deg2Rad;
                float value = Mathf.Clamp01(_values[i]);
                Vector2 point = center + new Vector2(
                    Mathf.Cos(angle) * _radius * value,
                    Mathf.Sin(angle) * _radius * value
                );

                vh.AddVert(point, _fillColor, Vector2.zero);
            }

            // Triangles (fan from center)
            for (int i = 0; i < _axisCount; i++)
            {
                int next = (i % _axisCount) + 1;
                int afterNext = (i + 1) % _axisCount + 1;
                vh.AddTriangle(0, next, afterNext);
            }
        }
    }
}
