import IndexBuffer from './index_buffer';
import VertexBuffer from './vertex_buffer';
import Framebuffer from './framebuffer';
import ColorMode from './color_mode';
import {deepEqual} from '../util/util';
import {ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, BlendEquation, CullFace, CullFaceSide, FrontFace, Program, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArrayOES, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha, PixelStoreUnpackFlipY} from './value';

import type DepthMode from './depth_mode';
import type StencilMode from './stencil_mode';
import type CullFaceMode from './cull_face_mode';
import type {DepthBufferType, ColorMaskType} from './types';
import type {TriangleIndexArray, LineIndexArray, LineStripIndexArray} from '../data/index_array_type';
import type {
    StructArray,
    StructArrayMember
} from '../util/struct_array';
import type Color from '../style-spec/util/color';

type ClearArgs = {
    color?: Color;
    depth?: number;
    stencil?: number;
    colorMask?: ColorMaskType;
};

export type ContextOptions = {
    extTextureFilterAnisotropicForceOff?: boolean;
    extTextureFloatLinearForceOff?: boolean;
    extStandardDerivativesForceOff?: boolean;
    forceManualRenderingForInstanceIDShaders?: boolean;
};

class Context {
    gl: WebGL2RenderingContext;
    currentNumAttributes: number | null | undefined;
    maxTextureSize: number;

    clearColor: ClearColor;
    clearDepth: ClearDepth;
    clearStencil: ClearStencil;
    colorMask: ColorMask;
    depthMask: DepthMask;
    stencilMask: StencilMask;
    stencilFunc: StencilFunc;
    stencilOp: StencilOp;
    stencilTest: StencilTest;
    depthRange: DepthRange;
    depthTest: DepthTest;
    depthFunc: DepthFunc;
    blend: Blend;
    blendFunc: BlendFunc;
    blendColor: BlendColor;
    blendEquation: BlendEquation;
    cullFace: CullFace;
    cullFaceSide: CullFaceSide;
    frontFace: FrontFace;
    program: Program;
    activeTexture: ActiveTextureUnit;
    viewport: Viewport;
    bindFramebuffer: BindFramebuffer;
    bindRenderbuffer: BindRenderbuffer;
    bindTexture: BindTexture;
    bindVertexBuffer: BindVertexBuffer;
    bindElementBuffer: BindElementBuffer;
    bindVertexArrayOES: BindVertexArrayOES;
    pixelStoreUnpack: PixelStoreUnpack;
    pixelStoreUnpackPremultiplyAlpha: PixelStoreUnpackPremultiplyAlpha;
    pixelStoreUnpackFlipY: PixelStoreUnpackFlipY;
    renderer: string | null | undefined;
    vendor: string | null | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extTextureFilterAnisotropic: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extTextureFilterAnisotropicMax: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extTextureHalfFloat: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extRenderToTextureHalfFloat: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extDebugRendererInfo: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extTimerQuery: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extTextureFloatLinear: any;
    options: ContextOptions;
    maxPointSize: number;

    forceManualRenderingForInstanceIDShaders: boolean;

    constructor(gl: WebGL2RenderingContext, options?: ContextOptions) {
        this.gl = gl;

        this.clearColor = new ClearColor(this);
        this.clearDepth = new ClearDepth(this);
        this.clearStencil = new ClearStencil(this);
        this.colorMask = new ColorMask(this);
        this.depthMask = new DepthMask(this);
        this.stencilMask = new StencilMask(this);
        this.stencilFunc = new StencilFunc(this);
        this.stencilOp = new StencilOp(this);
        this.stencilTest = new StencilTest(this);
        this.depthRange = new DepthRange(this);
        this.depthTest = new DepthTest(this);
        this.depthFunc = new DepthFunc(this);
        this.blend = new Blend(this);
        this.blendFunc = new BlendFunc(this);
        this.blendColor = new BlendColor(this);
        this.blendEquation = new BlendEquation(this);
        this.cullFace = new CullFace(this);
        this.cullFaceSide = new CullFaceSide(this);
        this.frontFace = new FrontFace(this);
        this.program = new Program(this);
        this.activeTexture = new ActiveTextureUnit(this);
        this.viewport = new Viewport(this);
        this.bindFramebuffer = new BindFramebuffer(this);
        this.bindRenderbuffer = new BindRenderbuffer(this);
        this.bindTexture = new BindTexture(this);
        this.bindVertexBuffer = new BindVertexBuffer(this);
        this.bindElementBuffer = new BindElementBuffer(this);
        this.bindVertexArrayOES = new BindVertexArrayOES(this);
        this.pixelStoreUnpack = new PixelStoreUnpack(this);
        this.pixelStoreUnpackPremultiplyAlpha = new PixelStoreUnpackPremultiplyAlpha(this);
        this.pixelStoreUnpackFlipY = new PixelStoreUnpackFlipY(this);
        this.options = options ? Object.assign({}, options) : {};

        if (!this.options.extTextureFilterAnisotropicForceOff) {
            this.extTextureFilterAnisotropic = (
                gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
            );
            if (this.extTextureFilterAnisotropic) {
                this.extTextureFilterAnisotropicMax = gl.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            }
        }

        this.extDebugRendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (this.extDebugRendererInfo) {
            this.renderer = gl.getParameter(this.extDebugRendererInfo.UNMASKED_RENDERER_WEBGL);
            this.vendor = gl.getParameter(this.extDebugRendererInfo.UNMASKED_VENDOR_WEBGL);
        }

        // Force manual rendering for instanced draw calls having gl_InstanceID usage in the shader for PowerVR adapters
        this.forceManualRenderingForInstanceIDShaders = (options && !!options.forceManualRenderingForInstanceIDShaders) || (this.renderer && this.renderer.indexOf("PowerVR") !== -1);

        if (!this.options.extTextureFloatLinearForceOff) {
            this.extTextureFloatLinear = gl.getExtension('OES_texture_float_linear');
        }
        this.extRenderToTextureHalfFloat = gl.getExtension('EXT_color_buffer_half_float');

        this.extTimerQuery = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.maxPointSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
    }

    setDefault() {
        this.unbindVAO();

        this.clearColor.setDefault();
        this.clearDepth.setDefault();
        this.clearStencil.setDefault();
        this.colorMask.setDefault();
        this.depthMask.setDefault();
        this.stencilMask.setDefault();
        this.stencilFunc.setDefault();
        this.stencilOp.setDefault();
        this.stencilTest.setDefault();
        this.depthRange.setDefault();
        this.depthTest.setDefault();
        this.depthFunc.setDefault();
        this.blend.setDefault();
        this.blendFunc.setDefault();
        this.blendColor.setDefault();
        this.blendEquation.setDefault();
        this.cullFace.setDefault();
        this.cullFaceSide.setDefault();
        this.frontFace.setDefault();
        this.program.setDefault();
        this.activeTexture.setDefault();
        this.bindFramebuffer.setDefault();
        this.pixelStoreUnpack.setDefault();
        this.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.pixelStoreUnpackFlipY.setDefault();
    }

    setDirty() {
        this.clearColor.dirty = true;
        this.clearDepth.dirty = true;
        this.clearStencil.dirty = true;
        this.colorMask.dirty = true;
        this.depthMask.dirty = true;
        this.stencilMask.dirty = true;
        this.stencilFunc.dirty = true;
        this.stencilOp.dirty = true;
        this.stencilTest.dirty = true;
        this.depthRange.dirty = true;
        this.depthTest.dirty = true;
        this.depthFunc.dirty = true;
        this.blend.dirty = true;
        this.blendFunc.dirty = true;
        this.blendColor.dirty = true;
        this.blendEquation.dirty = true;
        this.cullFace.dirty = true;
        this.cullFaceSide.dirty = true;
        this.frontFace.dirty = true;
        this.program.dirty = true;
        this.activeTexture.dirty = true;
        this.viewport.dirty = true;
        this.bindFramebuffer.dirty = true;
        this.bindRenderbuffer.dirty = true;
        this.bindTexture.dirty = true;
        this.bindVertexBuffer.dirty = true;
        this.bindElementBuffer.dirty = true;
        this.bindVertexArrayOES.dirty = true;
        this.pixelStoreUnpack.dirty = true;
        this.pixelStoreUnpackPremultiplyAlpha.dirty = true;
        this.pixelStoreUnpackFlipY.dirty = true;
    }

    createIndexBuffer(
        array: TriangleIndexArray | LineIndexArray | LineStripIndexArray,
        dynamicDraw?: boolean,
        noDestroy?: boolean,
    ): IndexBuffer {
        return new IndexBuffer(this, array, dynamicDraw, noDestroy);
    }

    createVertexBuffer(
        array: StructArray,
        attributes: ReadonlyArray<StructArrayMember>,
        dynamicDraw?: boolean,
        noDestroy?: boolean,
        instanceCount?: number,
    ): VertexBuffer {
        return new VertexBuffer(this, array, attributes, dynamicDraw, noDestroy, instanceCount);
    }

    createRenderbuffer(storageFormat: number, width: number, height: number): WebGLRenderbuffer | null | undefined {
        const gl = this.gl;

        const rbo = gl.createRenderbuffer();
        this.bindRenderbuffer.set(rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, storageFormat, width, height);
        this.bindRenderbuffer.set(null);

        return rbo;
    }

    createFramebuffer(
        width: number,
        height: number,
        hasColor: boolean,
        depthType?: DepthBufferType | null,
    ): Framebuffer {
        return new Framebuffer(this, width, height, hasColor, depthType);
    }

    clear({
        color,
        depth,
        stencil,
        colorMask,
    }: ClearArgs) {
        const gl = this.gl;
        let mask = 0;

        if (color) {
            mask |= gl.COLOR_BUFFER_BIT;
            this.clearColor.set(color);
            if (colorMask) {
                this.colorMask.set(colorMask);
            } else {
                this.colorMask.set([true, true, true, true]);
            }
        }

        if (typeof depth !== 'undefined') {
            mask |= gl.DEPTH_BUFFER_BIT;

            // Workaround for platforms where clearDepth doesn't seem to work
            // without reseting the depthRange. See https://github.com/mapbox/mapbox-gl-js/issues/3437
            this.depthRange.set([0, 1]);

            this.clearDepth.set(depth);
            this.depthMask.set(true);
        }

        if (typeof stencil !== 'undefined') {
            mask |= gl.STENCIL_BUFFER_BIT;
            this.clearStencil.set(stencil);
            this.stencilMask.set(0xFF);
        }

        gl.clear(mask);
    }

    setCullFace(cullFaceMode: Readonly<CullFaceMode>) {
        if (cullFaceMode.enable === false) {
            this.cullFace.set(false);
        } else {
            this.cullFace.set(true);
            this.cullFaceSide.set(cullFaceMode.mode);
            this.frontFace.set(cullFaceMode.frontFace);
        }
    }

    setDepthMode(depthMode: Readonly<DepthMode>) {
        if (depthMode.func === this.gl.ALWAYS && !depthMode.mask) {
            this.depthTest.set(false);
        } else {
            this.depthTest.set(true);
            this.depthFunc.set(depthMode.func);
            this.depthMask.set(depthMode.mask);
            this.depthRange.set(depthMode.range);
        }
    }

    setStencilMode(stencilMode: Readonly<StencilMode>) {
        if (stencilMode.test.func === this.gl.ALWAYS && !stencilMode.mask) {
            this.stencilTest.set(false);
        } else {
            this.stencilTest.set(true);
            this.stencilMask.set(stencilMode.mask);
            this.stencilOp.set([stencilMode.fail, stencilMode.depthFail, stencilMode.pass]);
            this.stencilFunc.set({
                func: stencilMode.test.func,
                ref: stencilMode.ref,
                mask: stencilMode.test.mask
            });
        }
    }

    setColorMode(colorMode: Readonly<ColorMode>) {
        if (deepEqual(colorMode.blendFunction, ColorMode.Replace)) {
            this.blend.set(false);
        } else {
            this.blend.set(true);
            this.blendFunc.set(colorMode.blendFunction);
            this.blendColor.set(colorMode.blendColor);
            if (colorMode.blendEquation) {
                this.blendEquation.set(colorMode.blendEquation);
            } else {
                this.blendEquation.setDefault();
            }
        }

        this.colorMask.set(colorMode.mask);
    }

    unbindVAO() {
        // Unbinding the VAO prevents other things (custom layers, new buffer creation) from
        // unintentionally changing the state of the last VAO used.
        this.bindVertexArrayOES.set(null);
    }
}

export default Context;
