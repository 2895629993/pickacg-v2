"use client"

import { useEffect } from "react"

const menuLabelMap = new Map<string, string>([
    ["Route", "路由"],
    ["Turbopack", "Turbopack"],
    ["Route Info", "路由信息"],
    ["Preferences", "偏好设置"],
])

const menuValueMap = new Map<string, string>([
    ["Static", "静态"],
    ["Dynamic", "动态"],
    ["Enabled", "已启用"],
    ["Disabled", "已禁用"],
])

const titleMap = new Map<string, string>([
    ["Current route is static.", "当前路由为静态。"],
    ["Current route is dynamic.", "当前路由为动态。"],
    ["Turbopack is enabled.", "Turbopack 已启用。"],
    ["Turbopack is disabled.", "Turbopack 已禁用。"],
])

function replaceTextContent(root: ParentNode) {
    const menu = root.querySelector<HTMLElement>("#nextjs-dev-tools-menu")
    if (!menu) { return }

    if (menu.getAttribute("aria-label") === "Next.js Dev Tools Items") {
        menu.setAttribute("aria-label", "Next.js 开发工具菜单项")
    }

    for (const item of menu.querySelectorAll<HTMLElement>(".dev-tools-indicator-item")) {
        const title = item.getAttribute("title")
        if (title && titleMap.has(title)) {
            item.setAttribute("title", titleMap.get(title) ?? title)
        }

        const label = item.querySelector<HTMLElement>(".dev-tools-indicator-label")
        if (label) {
            const nextLabel = menuLabelMap.get(label.textContent?.trim() ?? "")
            if (nextLabel) {
                label.textContent = nextLabel
            }
        }

        const value = item.querySelector<HTMLElement>(".dev-tools-indicator-value")
        if (value && value.childElementCount === 0) {
            const nextValue = menuValueMap.get(value.textContent?.trim() ?? "")
            if (nextValue) {
                value.textContent = nextValue
            }
        }
    }
}

export function NextDevToolsI18n() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "development") { return }

        replaceTextContent(document)

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) { continue }
                    replaceTextContent(node)
                }
            }

            replaceTextContent(document)
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        })

        return () => observer.disconnect()
    }, [])

    return null
}
