/**
 * IM Slice
 * Redux slice for IM gateway state management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type {
  DingTalkInstanceConfig,
  DingTalkMultiInstanceConfig,
  DingTalkOpenClawConfig,
  DiscordOpenClawConfig,
  FeishuInstanceConfig,
  FeishuMultiInstanceConfig,
  FeishuOpenClawConfig,
  IMGatewayConfig,
  IMGatewayStatus,
  IMSettings,
  NeteaseBeeChanConfig,
  NimConfig,
  NimInstanceConfig,
  NimMultiInstanceConfig,
  PopoInstanceConfig,
  PopoMultiInstanceConfig,
  PopoOpenClawConfig,
  QQInstanceConfig,
  QQMultiInstanceConfig,
  QQOpenClawConfig,
  TelegramOpenClawConfig,
  WecomInstanceConfig,
  WecomMultiInstanceConfig,
  WecomOpenClawConfig,
  WeixinOpenClawConfig,
} from '../../types/im';
import {
  DEFAULT_IM_CONFIG,
  DEFAULT_IM_STATUS,
} from '../../types/im';

export interface IMState {
  config: IMGatewayConfig;
  status: IMGatewayStatus;
  isLoading: boolean;
  error: string | null;
}

const initialState: IMState = {
  config: DEFAULT_IM_CONFIG,
  status: DEFAULT_IM_STATUS,
  isLoading: false,
  error: null,
};

const removeStaleInstanceBindings = (
  settings: IMSettings,
  platform: 'dingtalk' | 'feishu' | 'nim' | 'popo' | 'qq' | 'wecom',
  instances: readonly { instanceId: string }[],
): void => {
  const bindings = settings.platformAgentBindings;
  if (!bindings) {
    return;
  }

  const nextInstanceIds = new Set(instances.map((instance) => instance.instanceId));
  for (const bindingKey of Object.keys(bindings)) {
    if (!bindingKey.startsWith(`${platform}:`)) {
      continue;
    }
    const instanceId = bindingKey.slice(platform.length + 1);
    if (!nextInstanceIds.has(instanceId)) {
      delete bindings[bindingKey];
    }
  }
};

const removeAllStaleMultiInstanceBindings = (config: IMGatewayConfig): void => {
  removeStaleInstanceBindings(config.settings, 'dingtalk', config.dingtalk.instances);
  removeStaleInstanceBindings(config.settings, 'feishu', config.feishu.instances);
  removeStaleInstanceBindings(config.settings, 'nim', config.nim.instances ?? []);
  removeStaleInstanceBindings(config.settings, 'popo', config.popo.instances ?? []);
  removeStaleInstanceBindings(config.settings, 'qq', config.qq.instances);
  removeStaleInstanceBindings(config.settings, 'wecom', config.wecom.instances);
};

const imSlice = createSlice({
  name: 'im',
  initialState,
  reducers: {
    setConfig: (state, action: PayloadAction<IMGatewayConfig>) => {
      state.config = action.payload;
      removeAllStaleMultiInstanceBindings(state.config);
    },
    setDingTalkInstances: (state, action: PayloadAction<DingTalkInstanceConfig[]>) => {
      state.config.dingtalk = { instances: action.payload };
      removeStaleInstanceBindings(state.config.settings, 'dingtalk', action.payload);
    },
    setDingTalkMultiInstanceConfig: (state, action: PayloadAction<DingTalkMultiInstanceConfig>) => {
      state.config.dingtalk = action.payload;
      removeStaleInstanceBindings(state.config.settings, 'dingtalk', action.payload.instances);
    },
    setDingTalkInstanceConfig: (state, action: PayloadAction<{ instanceId: string; config: Partial<DingTalkOpenClawConfig> }>) => {
      const inst = state.config.dingtalk.instances.find((item) => item.instanceId === action.payload.instanceId);
      if (inst) Object.assign(inst, action.payload.config);
    },
    addDingTalkInstance: (state, action: PayloadAction<DingTalkInstanceConfig>) => {
      state.config.dingtalk.instances.push(action.payload);
    },
    removeDingTalkInstance: (state, action: PayloadAction<string>) => {
      state.config.dingtalk.instances = state.config.dingtalk.instances.filter(
        (item) => item.instanceId !== action.payload
      );
      delete state.config.settings.platformAgentBindings?.[`dingtalk:${action.payload}`];
    },
    setFeishuInstances: (state, action: PayloadAction<FeishuInstanceConfig[]>) => {
      state.config.feishu = { instances: action.payload };
      removeStaleInstanceBindings(state.config.settings, 'feishu', action.payload);
    },
    setFeishuMultiInstanceConfig: (state, action: PayloadAction<FeishuMultiInstanceConfig>) => {
      state.config.feishu = action.payload;
      removeStaleInstanceBindings(state.config.settings, 'feishu', action.payload.instances);
    },
    setFeishuInstanceConfig: (state, action: PayloadAction<{ instanceId: string; config: Partial<FeishuOpenClawConfig> }>) => {
      const inst = state.config.feishu.instances.find((item) => item.instanceId === action.payload.instanceId);
      if (inst) Object.assign(inst, action.payload.config);
    },
    addFeishuInstance: (state, action: PayloadAction<FeishuInstanceConfig>) => {
      state.config.feishu.instances.push(action.payload);
    },
    removeFeishuInstance: (state, action: PayloadAction<string>) => {
      state.config.feishu.instances = state.config.feishu.instances.filter(
        (item) => item.instanceId !== action.payload
      );
      delete state.config.settings.platformAgentBindings?.[`feishu:${action.payload}`];
    },
    setTelegramOpenClawConfig: (state, action: PayloadAction<Partial<TelegramOpenClawConfig>>) => {
      state.config.telegram = {
        ...state.config.telegram,
        ...action.payload,
      };
    },
    setQQInstances: (state, action: PayloadAction<QQInstanceConfig[]>) => {
      state.config.qq = { instances: action.payload };
      removeStaleInstanceBindings(state.config.settings, 'qq', action.payload);
    },
    setQQMultiInstanceConfig: (state, action: PayloadAction<QQMultiInstanceConfig>) => {
      state.config.qq = action.payload;
      removeStaleInstanceBindings(state.config.settings, 'qq', action.payload.instances);
    },
    setQQInstanceConfig: (state, action: PayloadAction<{ instanceId: string; config: Partial<QQOpenClawConfig> }>) => {
      const inst = state.config.qq.instances.find((item) => item.instanceId === action.payload.instanceId);
      if (inst) Object.assign(inst, action.payload.config);
    },
    addQQInstance: (state, action: PayloadAction<QQInstanceConfig>) => {
      state.config.qq.instances.push(action.payload);
    },
    removeQQInstance: (state, action: PayloadAction<string>) => {
      state.config.qq.instances = state.config.qq.instances.filter(
        (item) => item.instanceId !== action.payload
      );
      delete state.config.settings.platformAgentBindings?.[`qq:${action.payload}`];
    },
    setDiscordConfig: (state, action: PayloadAction<Partial<DiscordOpenClawConfig>>) => {
      state.config.discord = { ...state.config.discord, ...action.payload };
    },
    setNimConfig: (state, action: PayloadAction<Partial<NimConfig>>) => {
      const first = state.config.nim.instances[0];
      if (first) {
        Object.assign(first, action.payload);
      }
      removeStaleInstanceBindings(state.config.settings, 'nim', state.config.nim.instances);
    },
    setNimInstances: (state, action: PayloadAction<NimInstanceConfig[]>) => {
      state.config.nim = { instances: action.payload };
      removeStaleInstanceBindings(state.config.settings, 'nim', action.payload);
    },
    setNimMultiInstanceConfig: (state, action: PayloadAction<NimMultiInstanceConfig>) => {
      state.config.nim = action.payload;
      removeStaleInstanceBindings(state.config.settings, 'nim', action.payload.instances);
    },
    setNimInstanceConfig: (state, action: PayloadAction<{ instanceId: string; config: Partial<NimInstanceConfig> }>) => {
      const inst = state.config.nim.instances.find((item) => item.instanceId === action.payload.instanceId);
      if (inst) Object.assign(inst, action.payload.config);
    },
    addNimInstance: (state, action: PayloadAction<NimInstanceConfig>) => {
      state.config.nim.instances.push(action.payload);
    },
    removeNimInstance: (state, action: PayloadAction<string>) => {
      state.config.nim.instances = state.config.nim.instances.filter(
        (item) => item.instanceId !== action.payload
      );
      delete state.config.settings.platformAgentBindings?.[`nim:${action.payload}`];
    },
    setNeteaseBeeChanConfig: (state, action: PayloadAction<Partial<NeteaseBeeChanConfig>>) => {
      state.config['netease-bee'] = { ...state.config['netease-bee'], ...action.payload };
    },
    setWecomInstances: (state, action: PayloadAction<WecomInstanceConfig[]>) => {
      state.config.wecom = { instances: action.payload };
      removeStaleInstanceBindings(state.config.settings, 'wecom', action.payload);
    },
    setWecomMultiInstanceConfig: (state, action: PayloadAction<WecomMultiInstanceConfig>) => {
      state.config.wecom = action.payload;
      removeStaleInstanceBindings(state.config.settings, 'wecom', action.payload.instances);
    },
    setWecomInstanceConfig: (state, action: PayloadAction<{ instanceId: string; config: Partial<WecomOpenClawConfig> }>) => {
      const inst = state.config.wecom.instances.find((item) => item.instanceId === action.payload.instanceId);
      if (inst) Object.assign(inst, action.payload.config);
    },
    addWecomInstance: (state, action: PayloadAction<WecomInstanceConfig>) => {
      state.config.wecom.instances.push(action.payload);
    },
    removeWecomInstance: (state, action: PayloadAction<string>) => {
      state.config.wecom.instances = state.config.wecom.instances.filter(
        (item) => item.instanceId !== action.payload
      );
      delete state.config.settings.platformAgentBindings?.[`wecom:${action.payload}`];
    },
    setPopoConfig: (state, action: PayloadAction<Partial<PopoOpenClawConfig>>) => {
      const first = state.config.popo.instances[0];
      if (first) {
        Object.assign(first, action.payload);
      }
      removeStaleInstanceBindings(state.config.settings, 'popo', state.config.popo.instances);
    },
    setPopoInstances: (state, action: PayloadAction<PopoInstanceConfig[]>) => {
      state.config.popo = { instances: action.payload };
      removeStaleInstanceBindings(state.config.settings, 'popo', action.payload);
    },
    setPopoMultiInstanceConfig: (state, action: PayloadAction<PopoMultiInstanceConfig>) => {
      state.config.popo = action.payload;
      removeStaleInstanceBindings(state.config.settings, 'popo', action.payload.instances);
    },
    setPopoInstanceConfig: (state, action: PayloadAction<{ instanceId: string; config: Partial<PopoInstanceConfig> }>) => {
      const inst = state.config.popo.instances.find((item) => item.instanceId === action.payload.instanceId);
      if (inst) Object.assign(inst, action.payload.config);
    },
    addPopoInstance: (state, action: PayloadAction<PopoInstanceConfig>) => {
      state.config.popo.instances.push(action.payload);
    },
    removePopoInstance: (state, action: PayloadAction<string>) => {
      state.config.popo.instances = state.config.popo.instances.filter(
        (item) => item.instanceId !== action.payload
      );
      delete state.config.settings.platformAgentBindings?.[`popo:${action.payload}`];
    },
    setWeixinConfig: (state, action: PayloadAction<Partial<WeixinOpenClawConfig>>) => {
      state.config.weixin = { ...state.config.weixin, ...action.payload };
    },
    setIMSettings: (state, action: PayloadAction<Partial<IMSettings>>) => {
      state.config.settings = { ...state.config.settings, ...action.payload };
    },
    setStatus: (state, action: PayloadAction<IMGatewayStatus>) => {
      state.status = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setConfig,
  setDingTalkInstances,
  setDingTalkMultiInstanceConfig,
  setDingTalkInstanceConfig,
  addDingTalkInstance,
  removeDingTalkInstance,
  setFeishuInstances,
  setFeishuMultiInstanceConfig,
  setFeishuInstanceConfig,
  addFeishuInstance,
  removeFeishuInstance,
  setTelegramOpenClawConfig,
  setQQInstances,
  setQQMultiInstanceConfig,
  setQQInstanceConfig,
  addQQInstance,
  removeQQInstance,
  setDiscordConfig,
  setNimConfig,
  setNimInstances,
  setNimMultiInstanceConfig,
  setNimInstanceConfig,
  addNimInstance,
  removeNimInstance,
  setNeteaseBeeChanConfig,
  setWecomInstances,
  setWecomMultiInstanceConfig,
  setWecomInstanceConfig,
  addWecomInstance,
  removeWecomInstance,
  setPopoConfig,
  setPopoInstances,
  setPopoMultiInstanceConfig,
  setPopoInstanceConfig,
  addPopoInstance,
  removePopoInstance,
  setWeixinConfig,
  setIMSettings,
  setStatus,
  setLoading,
  setError,
  clearError,
} = imSlice.actions;

export default imSlice.reducer;
