import { useEffect, useRef } from "react";
import { AEGIS_HALFTONE_DOTS } from "./aegisHalftoneData";

interface HalftoneHeroBackgroundProps {
  theme: "light" | "dark";
  hoveredSection?: "headline" | "post-bounty" | "register-agent" | "canvas" | null;
}

interface DotState {
  x: number; // normalized (-1..1)
  y: number; // normalized (-1..1)
  baseR: number; // normalized (0..1)
  illumination: number; // current glow (0..1)
}

export function HalftoneHeroBackground({
  theme,
  hoveredSection = null,
}: HalftoneHeroBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  const stateRef = useRef<{
    angle: number;
    offsetX: number;
    offsetY: number;
    pulseRadius: number;
    pulseActive: boolean;
    dots: DotState[];
  }>({
    angle: 0,
    offsetX: 0,
    offsetY: 0,
    pulseRadius: 0,
    pulseActive: false,
    dots: AEGIS_HALFTONE_DOTS.map(([x, y, r]) => ({
      x,
      y,
      baseR: r,
      illumination: 0,
    })),
  });

  // Trigger pulse wave on section changes (e.g. hovering canvas demo)
  useEffect(() => {
    if (hoveredSection) {
      stateRef.current.pulseRadius = 0;
      stateRef.current.pulseActive = true;
    }
  }, [hoveredSection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let computedCenterY = 235;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Dynamically align vertical center of emblem behind the hero headline
      const headlineEl = container.parentElement?.querySelector(".text-center") as HTMLElement | null;
      if (headlineEl) {
        const hRect = headlineEl.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        computedCenterY = Math.max(180, (hRect.top - cRect.top) + hRect.height * 0.42);
      } else {
        computedCenterY = Math.min(235, height * 0.28);
      }

      // Synchronize vignette mask center exactly with the emblem center
      const maskY = Math.round(computedCenterY);
      const maskStyle = `radial-gradient(ellipse 92% 78% at 50% ${maskY}px, black 38%, transparent 88%)`;
      container.style.maskImage = maskStyle;
      container.style.webkitMaskImage = maskStyle;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const parentSection = container.closest("section") || container;
    parentSection.addEventListener("mousemove", handleMouseMove as EventListener, { passive: true });
    parentSection.addEventListener("mouseleave", handleMouseLeave as EventListener, { passive: true });

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    const isDark = theme === "dark";

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const state = stateRef.current;
      const mouse = mouseRef.current;

      // Gentle continuous ambient rotation (~0.05 degrees / frame)
      state.angle += 0.0009;
      if (state.angle > Math.PI * 2) {
        state.angle -= Math.PI * 2;
      }

      // Center of the logo (aligned with the hero headline)
      const centerX = width / 2;
      const centerY = computedCenterY;

      // Subtle parallax response to mouse
      if (mouse.active) {
        const targetOffsetX = (mouse.x - centerX) * 0.035;
        const targetOffsetY = (mouse.y - centerY) * 0.035;
        state.offsetX += (targetOffsetX - state.offsetX) * 0.04;
        state.offsetY += (targetOffsetY - state.offsetY) * 0.04;
      } else {
        state.offsetX *= 0.96;
        state.offsetY *= 0.96;
      }

      const logoX = centerX + state.offsetX;
      const logoY = centerY + state.offsetY;

      // Scale diameter to fit viewport cleanly (50% larger: ~780px diameter on desktop)
      const logoRadius = Math.min(width * 0.55, 390);
      const dotBaseMaxRadius = logoRadius / 52;

      const cosA = Math.cos(state.angle);
      const sinA = Math.sin(state.angle);

      // Section hover targets for quadrant illumination
      let targetQuadAngle: number | null = null;
      if (hoveredSection === "headline") targetQuadAngle = -Math.PI / 2; // Top
      else if (hoveredSection === "post-bounty") targetQuadAngle = Math.PI * 0.85; // Bottom-left
      else if (hoveredSection === "register-agent") targetQuadAngle = 0.15; // Right

      // Update outward pulse wave
      if (state.pulseActive) {
        state.pulseRadius += logoRadius * 0.022;
        if (state.pulseRadius > logoRadius * 1.5) {
          state.pulseActive = false;
          state.pulseRadius = 0;
        }
      }

      // 1. Draw subtle ambient dot grid background
      const gridSpacing = 28;
      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.03)";
      for (let gx = gridSpacing / 2; gx < width; gx += gridSpacing) {
        for (let gy = gridSpacing / 2; gy < height; gy += gridSpacing) {
          const dToMouse = mouse.active ? Math.hypot(gx - mouse.x, gy - mouse.y) : 999;
          const ambientR = dToMouse < 90 ? 1.4 : 0.8;
          ctx.beginPath();
          ctx.arc(gx, gy, ambientR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Draw Aegis Halftone Emblem Dots
      const dots = state.dots;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        // Apply 2D rotation matrix to normalized coordinate
        const rx = dot.x * cosA - dot.y * sinA;
        const ry = dot.x * sinA + dot.y * cosA;

        // Convert to canvas coordinates
        const screenX = logoX + rx * logoRadius;
        const screenY = logoY + ry * logoRadius;

        // Proximity calculation from cursor
        const distToMouse = mouse.active ? Math.hypot(screenX - mouse.x, screenY - mouse.y) : 999;
        const mouseProximity = Math.max(0, 1 - distToMouse / 165);

        // Section quadrant illumination calculation
        let quadGlow = 0;
        if (targetQuadAngle !== null) {
          const dotAngle = Math.atan2(ry, rx);
          let diff = Math.abs(dotAngle - targetQuadAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff < Math.PI * 0.5) {
            quadGlow = Math.max(0, 1 - diff / (Math.PI * 0.5)) * 0.85;
          }
        }

        // Outward pulse wave calculation (e.g. when canvas reviewer hovered)
        let pulseGlow = 0;
        if (state.pulseActive) {
          const dotDistFromCenter = Math.hypot(rx * logoRadius, ry * logoRadius);
          const diffPulse = Math.abs(dotDistFromCenter - state.pulseRadius);
          if (diffPulse < 40) {
            pulseGlow = (1 - diffPulse / 40) * 0.9;
          }
        }

        const targetIllumination = Math.min(
          1,
          Math.pow(mouseProximity, 1.3) * 1.2 + quadGlow + pulseGlow
        );

        // Smooth spring/damping on illumination
        if (targetIllumination > dot.illumination) {
          dot.illumination += (targetIllumination - dot.illumination) * 0.25;
        } else {
          dot.illumination *= 0.93;
        }

        // Compute dot radius
        const idleRadius = dot.baseR * dotBaseMaxRadius * 0.88;
        const activeRadius = idleRadius * (1 + dot.illumination * 0.8);

        // Compute color and alpha
        let alpha: number;
        let fillStyle: string;

        if (isDark) {
          // Atmospheric watermark resting opacity behind text
          alpha = Math.min(1, 0.08 + dot.baseR * 0.12 + dot.illumination * 0.78);
          if (dot.illumination > 0.4) {
            // Bright luminous white with subtle glow when active
            fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
          } else {
            fillStyle = `rgba(228, 228, 231, ${alpha.toFixed(2)})`;
          }
        } else {
          // Light mode stark monochrome dots
          alpha = Math.min(1, 0.05 + dot.baseR * 0.09 + dot.illumination * 0.78);
          fillStyle = `rgba(9, 9, 11, ${alpha.toFixed(2)})`;
        }

        // Render dot
        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(0.6, activeRadius), 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();

        // Optional subtle glow halo on strongly illuminated dots
        if (dot.illumination > 0.5 && isDark) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, activeRadius * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${(dot.illumination * 0.12).toFixed(3)})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      parentSection.removeEventListener("mousemove", handleMouseMove as EventListener);
      parentSection.removeEventListener("mouseleave", handleMouseLeave as EventListener);
    };
  }, [theme, hoveredSection]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        maskImage: "radial-gradient(ellipse 92% 78% at 50% 235px, black 38%, transparent 88%)",
        WebkitMaskImage: "radial-gradient(ellipse 92% 78% at 50% 235px, black 38%, transparent 88%)",
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
