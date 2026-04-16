"use client"

import useSWR from "swr"
import Image from "next/image"
import Link from "next/link"
import { SiGithub } from "react-icons/si"
import { Bug } from "lucide-react"
import { useQueryState, parseAsJson } from "nuqs"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { activityOf } from "@/app/actions"

const projectRepoUrl = "https://github.com/2895629993/pickacg-v2"
const debugSchema = z.object({
    enable: z.boolean(),
    sorting: z.object({
        showTagScore: z.boolean(),
    }),
    tags: z.object({
        highlightHighWeight: z.boolean(),
    }),
    request: z.object({
        showSearchMeta: z.boolean(),
    }),
})

export function NavigationBar({ className, ...props }: React.ComponentProps<'ul'>) {
    const { data: session, isPending } = authClient.useSession()
    const user = session?.user
    const [debugMenu, setDebugMenu] = useQueryState('debug', parseAsJson(debugSchema).withDefault({
        enable: false,
        sorting: { showTagScore: false },
        tags: { highlightHighWeight: true },
        request: { showSearchMeta: false },
    }))

    const { data, isLoading, error } = useSWR(
        user?.email ? ['activity', user.email] as const : null,
        ([, identifier]) => activityOf(identifier)
    )
    const activities = Object.entries(data || {}).sort(([a], [b]) => a.localeCompare(b))
    const activeDays = activities.map(([, count]) => count).filter((count: number) => count > 0).sort((a: number, b: number) => a - b)

    return (
        <ul className={cn("sticky top-0 z-20 flex w-full items-center bg-background/90 backdrop-blur px-6 py-3 justify-between", className)} {...props}>
            <li className="contents">
                <Link href="/" className="flex items-center gap-3">
                    <Image
                        className="dark:invert"
                        src="/pickacg.svg"
                        alt="PickACG logo"
                        width={36}
                        height={36}
                        priority
                    />
                    <h1 className="text-xl font-bold leading-tight">
                        PickACG
                    </h1>
                </Link>
            </li>
            <li /> {/* Placeholder */}
            <li className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant={debugMenu.enable ? "default" : "outline"} size="icon-sm">
                            <Bug />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>调试菜单</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                            checked={debugMenu.enable}
                            onCheckedChange={(checked) => setDebugMenu({ ...debugMenu, enable: Boolean(checked) })}
                        >
                            启用调试
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">排序调试</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={debugMenu.sorting.showTagScore}
                            disabled={!debugMenu.enable}
                            onCheckedChange={(checked) => setDebugMenu({
                                ...debugMenu,
                                enable: true,
                                sorting: { ...debugMenu.sorting, showTagScore: Boolean(checked) },
                            })}
                        >
                            可视化 tag.score
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">标签调试</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={debugMenu.tags.highlightHighWeight}
                            disabled={!debugMenu.enable}
                            onCheckedChange={(checked) => setDebugMenu({
                                ...debugMenu,
                                enable: true,
                                tags: { ...debugMenu.tags, highlightHighWeight: Boolean(checked) },
                            })}
                        >
                            高亮高权重标签
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">请求调试</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={debugMenu.request.showSearchMeta}
                            disabled={!debugMenu.enable}
                            onCheckedChange={(checked) => setDebugMenu({
                                ...debugMenu,
                                enable: true,
                                request: { ...debugMenu.request, showSearchMeta: Boolean(checked) },
                            })}
                        >
                            显示搜索元信息
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="icon-sm" asChild>
                    <Link
                        href={projectRepoUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <SiGithub />
                    </Link>
                </Button>
            </li>
        </ul>
    )
}
