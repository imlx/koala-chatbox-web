import * as THREE from 'three'

// ============================================================
// Dot Matrix Shader - 从 cua.ai 原样提取的点阵/CRT 后处理着色器
// ============================================================
export function dotMatrixShader(width, height) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(width, height) },
      uDotSize: { value: 5 },
      uDotGap: { value: 2.5 },
      uBrightness: { value: 1.1 },
      uContrast: { value: 0.5 },
      uThreshold: { value: 0.01 },
      uDotColor: { value: new THREE.Color(0.965, 0.973, 0.984) },
      uBgColor: { value: new THREE.Color(0.027, 0.031, 0.039) },
      uCrossEnabled: { value: 0 },
      uCrossIntensity: { value: 0.95 },
      uCrossAngle: { value: 0.4363 },
      uBloomEnabled: { value: 1 },
      uBloomIntensity: { value: 0.55 },
      uBloomSize: { value: 1.5 },
      uCrtEnabled: { value: 1 },
      uCrtCurvature: { value: 0 },
      uCrtScanlines: { value: 0.75 },
      uCrtVignette: { value: 2 },
      uCrtChroma: { value: 0 },
      uDitherEnabled: { value: 1 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uDotSize;
      uniform float uDotGap;
      uniform float uBrightness;
      uniform float uContrast;
      uniform float uThreshold;
      uniform vec3 uDotColor;
      uniform vec3 uBgColor;
      uniform float uCrossEnabled;
      uniform float uCrossIntensity;
      uniform float uCrossAngle;
      uniform float uBloomEnabled;
      uniform float uBloomIntensity;
      uniform float uBloomSize;
      uniform float uCrtEnabled;
      uniform float uCrtCurvature;
      uniform float uCrtScanlines;
      uniform float uCrtVignette;
      uniform float uCrtChroma;
      uniform float uDitherEnabled;
      varying vec2 vUv;

      vec2 crtDistort(vec2 uv, float k) {
        vec2 cc = uv - 0.5;
        float r2 = dot(cc, cc);
        float f = 1.0 + r2 * k * 0.01;
        return cc * f + 0.5;
      }

      void main() {
        vec2 uv = vUv;
        if (uCrtEnabled > 0.5) {
          uv = crtDistort(uv, uCrtCurvature);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }
        }

        vec3 col;
        if (uCrtEnabled > 0.5 && uCrtChroma > 0.01) {
          vec2 dir = (uv - 0.5) * uCrtChroma * 0.002;
          col.r = texture2D(tDiffuse, uv + dir).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - dir).b;
        } else {
          vec4 texel = texture2D(tDiffuse, uv);
          if (texel.a < 0.01) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
          }
          col = texel.rgb;
        }

        if (uDitherEnabled < 0.5) {
          float rawLum = dot(col, vec3(0.299, 0.587, 0.114));
          if (rawLum < 0.02) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
          }
          float alpha = smoothstep(0.02, 0.08, rawLum);
          if (uCrtEnabled > 0.5 && uCrtScanlines > 0.001) {
            float scanline = sin(uv.y * uResolution.y * 0.8) * 0.5 + 0.5;
            col *= 1.0 - uCrtScanlines * (1.0 - scanline);
          }
          if (uCrtEnabled > 0.5 && uCrtVignette > 0.001) {
            vec2 vig = uv * (1.0 - uv);
            float vigMask = pow(vig.x * vig.y * 16.0, uCrtVignette * 0.3);
            col *= vigMask;
          }
          gl_FragColor = vec4(col, alpha);
          return;
        }

        vec2 pixelCoord = uv * uResolution;
        float spacing = uDotSize + uDotGap;
        vec2 cell = floor(pixelCoord / spacing);
        vec2 cellCenter = (cell + 0.5) * spacing;
        vec2 sampleUV = cellCenter / uResolution;
        vec4 cellSample;
        vec3 cellCol;

        if (uCrtEnabled > 0.5 && uCrtChroma > 0.01) {
          vec2 dir = (sampleUV - 0.5) * uCrtChroma * 0.002;
          cellCol.r = texture2D(tDiffuse, sampleUV + dir).r;
          cellCol.g = texture2D(tDiffuse, sampleUV).g;
          cellCol.b = texture2D(tDiffuse, sampleUV - dir).b;
          cellSample = texture2D(tDiffuse, sampleUV);
        } else {
          cellSample = texture2D(tDiffuse, sampleUV);
          cellCol = cellSample.rgb;
        }

        if (cellSample.a < 0.01) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          return;
        }

        float lum = dot(cellCol, vec3(0.299, 0.587, 0.114));
        lum *= uBrightness;
        lum = (lum - 0.5) * (1.0 / uContrast) + 0.5;
        lum = clamp(lum, 0.0, 1.0);

        if (lum < uThreshold) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          return;
        }

        float maxRadius = uDotSize * 0.5;
        float minRadius = 0.4;
        float lumCurve = pow(lum, uContrast);
        float dotRadius = mix(minRadius, maxRadius, lumCurve);
        vec2 d = pixelCoord - cellCenter;
        vec2 absD = abs(d);
        float cornerRadius = mix(0.8, 0.2, lumCurve);
        float squareness = smoothstep(0.15, 0.7, lumCurve);
        float circleDist = length(d);
        float circleEdge = 1.0 - smoothstep(dotRadius - 0.5, dotRadius + 0.5, circleDist);
        vec2 qd = absD - vec2(dotRadius - cornerRadius);
        float rsDist = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0) - cornerRadius;
        float squareEdge = 1.0 - smoothstep(-0.5, 0.5, rsDist);
        float dotMask = mix(circleEdge, squareEdge, squareness);

        vec3 brightColor = uDotColor;
        vec3 midColor = uDotColor * 0.7;
        vec3 dimColor = uDotColor * 0.25;
        vec3 colNorm = cellCol / (max(max(cellCol.r, cellCol.g), cellCol.b) + 0.001);
        vec3 dotColor;
        if (lum > 0.65) {
          dotColor = mix(brightColor, brightColor * colNorm * 1.5, 0.2);
          dotColor *= 1.0 + (lum - 0.65) * 1.5;
        } else if (lum > 0.25) {
          float mt = (lum - 0.25) / 0.4;
          dotColor = mix(midColor, brightColor, mt);
          dotColor = mix(dotColor, dotColor * colNorm * 1.2, 0.15);
        } else {
          float st = lum / 0.25;
          dotColor = mix(dimColor * 0.5, dimColor, st);
        }

        float shadowCrosshatch = 0.0;
        if (uCrossEnabled > 0.5 && lum < 0.35) {
          float crossSpacing = spacing * 0.7;
          float ca = cos(uCrossAngle);
          float sa = sin(uCrossAngle);
          vec2 rotP = vec2(ca * pixelCoord.x - sa * pixelCoord.y, sa * pixelCoord.x + ca * pixelCoord.y);
          vec2 crossCell = floor(rotP / crossSpacing);
          vec2 crossCenter = (crossCell + 0.5) * crossSpacing;
          float crossDist = length(rotP - crossCenter);
          float shadowIntensity = smoothstep(0.35, 0.05, lum);
          float crossRadius = mix(0.3, maxRadius * 0.35, shadowIntensity);
          shadowCrosshatch = 1.0 - smoothstep(crossRadius - 0.4, crossRadius + 0.4, crossDist);
          shadowCrosshatch *= shadowIntensity * uCrossIntensity;
        }

        float bloomMask = 0.0;
        if (uBloomEnabled > 0.5 && lum > 0.6) {
          float bloomRadius = dotRadius * uBloomSize;
          float bloomDist = length(d);
          bloomMask = (1.0 - smoothstep(bloomRadius - 1.0, bloomRadius + 1.0, bloomDist));
          bloomMask *= smoothstep(0.6, 1.0, lum) * uBloomIntensity * 0.5;
        }

        vec3 result = uBgColor;
        vec3 crossColor = dimColor * 0.4;
        result = mix(result, crossColor, shadowCrosshatch);
        result += brightColor * bloomMask;
        result = mix(result, dotColor, dotMask);

        float innerMask = 0.0;
        if (squareness > 0.5) {
          vec2 qd2 = absD - vec2(dotRadius * 0.85 - cornerRadius);
          float rsDist2 = length(max(qd2, 0.0)) + min(max(qd2.x, qd2.y), 0.0) - cornerRadius;
          innerMask = 1.0 - smoothstep(-0.5, 0.5, rsDist2);
        } else {
          innerMask = 1.0 - smoothstep(dotRadius * 0.7 - 0.5, dotRadius * 0.7 + 0.5, circleDist);
        }

        float phosphorEdge = max(dotMask - innerMask, 0.0);
        result += brightColor * phosphorEdge * 0.15 * lum;

        if (uCrtEnabled > 0.5 && uCrtScanlines > 0.001) {
          float scanline = sin(uv.y * uResolution.y * 0.8) * 0.5 + 0.5;
          result *= 1.0 - uCrtScanlines * (1.0 - scanline);
        }
        if (uCrtEnabled > 0.5 && uCrtVignette > 0.001) {
          vec2 vig = uv * (1.0 - uv);
          float vigMask = pow(vig.x * vig.y * 16.0, uCrtVignette * 0.3);
          result *= vigMask;
        }

        float finalAlpha = max(dotMask, shadowCrosshatch);
        finalAlpha = max(finalAlpha, bloomMask * 0.5);
        finalAlpha = clamp(finalAlpha, 0.0, 1.0);
        gl_FragColor = vec4(result, finalAlpha);
      }
    `,
  }
}
