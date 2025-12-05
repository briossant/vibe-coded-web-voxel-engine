import * as THREE from 'three';

export const CloudShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#ffffff') },
        uCloudScale: { value: 0.008 },
        uCloudSpeed: { value: 0.02 },
        uOpacity: { value: 0.8 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uCloudScale;
        uniform float uCloudSpeed;
        uniform float uOpacity;
        varying vec3 vWorldPos;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i + vec2(0.0, 0.0));
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
            float total = 0.0;
            float amp = 0.5;
            for (int i = 0; i < 5; i++) {
                total += noise(p) * amp;
                p *= 2.1;
                amp *= 0.5;
            }
            return total;
        }

        void main() {
            vec2 pos = vWorldPos.xz * uCloudScale;
            pos.x += uTime * uCloudSpeed;
            pos.y += uTime * uCloudSpeed * 0.5;
            float n = fbm(pos);
            float alpha = smoothstep(0.4, 0.8, n);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
    `
};
