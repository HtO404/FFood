/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 小程序全局 wx 对象（云开发环境）
interface WxLoginResult {
  code: string
}
interface Wx {
  login?: (opts: { success: (r: WxLoginResult) => void; fail?: (err: any) => void }) => void
  cloud?: any
}
declare const wx: Wx | undefined

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_DEEPSEEK_API_KEY?: string
  readonly VITE_DEEPSEEK_BASE_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
