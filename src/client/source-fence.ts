import { fromMarkdown } from 'mdast-util-from-markdown'
import type { AssistantBlock, ChatNode, ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'

export interface SourceFence {
  lang: string | null
  value: string
  openingLineComplete: boolean
}

interface MarkdownNode {
  type: string
  lang?: string | null
  value?: string
  children?: MarkdownNode[]
  position?: { start: { offset?: number } }
}

/** 围栏开头的 `dsh-ui` 标签在书写时可能被带上标点（```dsh-ui> / ```dsh-ui` …）。
 * 这类标记在 mdast 里原样留在 `lang` 上，严格相等判断会让整条围栏静默退化成
 * 普通代码块——真实会话里同一个模型可以在一条消息里写出 182 个这样的围栏。
 * 这里只吸收**标签之后**的标点，`dsh-ui-something` 这样的真实语言名不受影响。 */
const GENUI_LABEL_PATTERN = /^dsh-ui$/
const GENUI_TRAILING_PUNCTUATION = /[>`"'.,;:)\]】」』]+$/

/**
 * 把宿主的围栏语言标记规范化成 GenUI 能识别的写法。
 *
 * @param lang - 宿主 markdown 里的原始 language（可能含尾部标点或大小写差异）
 * @returns 规范化后的语言名；无法规范化时返回输入本身
 */
export function normalizeFenceLanguage(lang: string): string {
  const trimmed = lang.trim()
  if (GENUI_LABEL_PATTERN.test(trimmed.toLowerCase())) return 'dsh-ui'
  const stripped = trimmed.replace(GENUI_TRAILING_PUNCTUATION, '').trim().toLowerCase()
  if (GENUI_LABEL_PATTERN.test(stripped)) return 'dsh-ui'
  return lang
}

/**
 * 判断语言标记是否指向 GenUI 围栏。
 *
 * @param lang - 宿主暴露的围栏语言（`null` = 围栏没有语言）
 * @returns 规范化为 `dsh-ui` 时返回 true
 */
export function isGenuiFenceLanguage(lang: string | null | undefined): boolean {
  return typeof lang === 'string' && normalizeFenceLanguage(lang) === 'dsh-ui'
}

/**
 * 按 Markdown 文档顺序读取所有代码围栏。
 *
 * @param markdown - assistant text block 中的 Markdown 内容
 * @returns Markdown AST 中的代码围栏
 */
export function sourceFencesOf(markdown: string): SourceFence[] {
  const fences: SourceFence[] = []
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'code') {
      const openingOffset = node.position?.start.offset
      const openingLineEnd = openingOffset === undefined ? -1 : markdown.indexOf('\n', openingOffset)
      const rawLang = node.lang ?? null
      fences.push({
        lang: rawLang === null ? null : normalizeFenceLanguage(rawLang),
        value: node.value as string,
        openingLineComplete: openingLineEnd >= 0,
      })
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(fromMarkdown(markdown) as unknown as MarkdownNode)
  return fences
}

/**
 * 只从 assistant 的 text blocks 中读取代码围栏。
 *
 * @param blocks - ChatSnapshot 提供的 assistant 内容块
 * @returns 按内容块顺序排列的代码围栏
 */
export function sourceFencesOfAssistant(blocks: readonly AssistantBlock[]): SourceFence[] {
  const fences: SourceFence[] = []
  for (const block of blocks) {
    if (block.kind === 'text') fences.push(...sourceFencesOf(block.text))
  }
  return fences
}

/**
 * 根据 assistant node key 和围栏序号读取公开 ChatSnapshot 中的 language。
 *
 * @param chat - 当前会话的 ChatSnapshot
 * @param nodeKey - DOM assistant row 对应的 Chat node key
 * @param index - assistant row 内从零开始的宿主代码块序号
 * @returns 原始 language；null 表示围栏没有 language，undefined 表示 source 不可用
 */
export function sourceLanguageAt(chat: ChatSnapshot | undefined, nodeKey: string, index: number): string | null | undefined {
  const node = chat?.nodes.get(nodeKey)
  if (node?.kind !== 'assistant-step') return undefined
  const assistantNode = node as ChatNode<'assistant-step'>
  const fence = sourceFencesOfAssistant(assistantNode.data.blocks)[index]
  return fence?.lang
}
