"use client"

import useSWR from "swr"
import Image from "next/image"
import Link from "next/link"
import { SiGithub } from "react-icons/si"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
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

export function NavigationBar({ className, ...props }: React.ComponentProps<'ul'>) {
    const { data: session, isPending } = authClient.useSession()
    const user = session?.user

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
