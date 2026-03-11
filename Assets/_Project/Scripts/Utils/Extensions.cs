using UnityEngine;

namespace Apex.Utils
{
    /// <summary>
    /// C# extension methods for common Unity operations.
    /// </summary>
    public static class Extensions
    {
        /// <summary>
        /// Set only the x component of a Vector3.
        /// </summary>
        public static Vector3 WithX(this Vector3 v, float x) => new(x, v.y, v.z);

        /// <summary>
        /// Set only the y component of a Vector3.
        /// </summary>
        public static Vector3 WithY(this Vector3 v, float y) => new(v.x, y, v.z);

        /// <summary>
        /// Set only the z component of a Vector3.
        /// </summary>
        public static Vector3 WithZ(this Vector3 v, float z) => new(v.x, v.y, z);

        /// <summary>
        /// Return a Vector3 with y set to 0 (flat projection).
        /// </summary>
        public static Vector3 Flat(this Vector3 v) => new(v.x, 0f, v.z);

        /// <summary>
        /// Remap a value from one range to another.
        /// </summary>
        public static float Remap(this float value, float fromMin, float fromMax, float toMin, float toMax)
        {
            return Mathf.Lerp(toMin, toMax, Mathf.InverseLerp(fromMin, fromMax, value));
        }

        /// <summary>
        /// Check if a layer mask contains a specific layer.
        /// </summary>
        public static bool Contains(this LayerMask mask, int layer)
        {
            return (mask.value & (1 << layer)) != 0;
        }

        /// <summary>
        /// Safely try to get a component, returning null instead of throwing.
        /// </summary>
        public static bool TryGet<T>(this GameObject go, out T component) where T : Component
        {
            return go.TryGetComponent(out component);
        }

        /// <summary>
        /// Fade a CanvasGroup's alpha over time (call from coroutine).
        /// </summary>
        public static void SetAlpha(this CanvasGroup cg, float alpha)
        {
            cg.alpha = alpha;
            cg.interactable = alpha > 0.5f;
            cg.blocksRaycasts = alpha > 0.5f;
        }
    }
}
