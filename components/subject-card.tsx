"use client"

import * as React from "react"
import { useQueryState, parseAsStringLiteral, parseAsJson } from "nuqs"
import { z } from "zod"
import Link from "next/link"
import Image from "next/image"
import { ExternalLink, Plus, Star, CalendarFold, Clapperboard, Book } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { cn } from "@/lib/utils"

import {
    Item,
    ItemContent,
    ItemHeader,
    ItemSeparator,
    ItemTitle,
} from "@/components/ui/item"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"

import { type Subject } from "@/types/api"
import { tagSchema } from "@/lib/search-params"
import { Category } from "@/lib/constants"

const bangumiUrl = process.env.NEXT_PUBLIC_BANGUMI_URL
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

const placeholderUrl = "https://lain.bgm.tv/img/no_icon_subject.png"

const AllowState = {
    Wait: 0,
    Preview: 1,
    Click: 2,
} as const

export function SubjectCard({
    className,
    subject,
    ...props
}: React.ComponentProps<typeof Item> & { subject: Subject }) {
    // Sync states with URL query parameters
    const [tagFilter, setTagFilter] = useQueryState('tags', parseAsJson(tagSchema).withDefault({ enable: true, tags: [], excludedTags: [] }))
    const [category] = useQueryState('category', parseAsStringLiteral(Object.values(Category)).withDefault(Category.Anime))
    const [debugMenu] = useQueryState('debug', parseAsJson(debugSchema).withDefault({
        enable: false,
        sorting: { showTagScore: false },
        tags: { highlightHighWeight: true },
        request: { showSearchMeta: false },
    }))

    const [isLoading, setIsLoading] = React.useState(true)
    const allowState = React.useRef<typeof AllowState[keyof typeof AllowState]>(AllowState.Wait)
    const visibleTagLimit = 8
    const sortedTags = (subject.tags ?? [])
        // filter out tags that are too long
        .filter(({ name }) => name && name.length < 16)
        // filter out tags that are too common
        .filter(({ name }) => !(category === Category.Anime && ["TV", "日本"].includes(name)))
        // filter out air date tags
        .filter(({ name }) => !(category === Category.Anime
            ? /^\d{4}年(\d{1,2}月)?$/.test(name)
            : /^\d{4}(年)?$/.test(name)
        ))
        // sort by count
        .sort((a, b) => b.count - a.count)
    const visibleTags = sortedTags.slice(0, visibleTagLimit)
    const hiddenTags = sortedTags.slice(visibleTagLimit)

    return (
        <Item key={subject.id} variant="muted" className={cn("flex-nowrap items-stretch sm:flex-wrap", className)} {...props}>
            <ItemHeader className="relative basis-auto sm:basis-full">
                <figure className="relative h-full w-auto sm:h-auto sm:w-full aspect-3/4 overflow-hidden rounded-2xl">
                    {isLoading && (
                        <Skeleton className="absolute inset-0 h-full w-full z-10" />
                    )}
                    <Link
                        href={`https://${bangumiUrl}/subject/${subject.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block h-full w-full"
                    >
                        <Image
                            src={subject.images?.common || placeholderUrl}
                            alt={subject.nameCN || subject.name}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                            onLoad={() => setIsLoading(false)}
                            unoptimized
                        />
                    </Link>
                    <ul className="absolute top-2 px-2 w-full flex gap-1 items-start justify-between min-h-5.5">
                        <li>
                            {subject.rating.rank > 0 && (
                                <Badge variant="secondary" className="bg-accent/60 backdrop-blur-xs font-semibold hidden sm:block">
                                    # {subject.rating.rank}
                                </Badge>
                            )}
                        </li>
                        <li className="contents">
                            {subject.rating.score > 0.0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary" className="bg-accent/60 backdrop-blur-xs font-semibold">
                                                <Star className="mr-0.5" />
                                                {subject.rating.score.toFixed(1)}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>{subject.rating.total} <span className="font-medium">人评分</span></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </li>
                    </ul>
                    <ul className="absolute bottom-2 px-2 w-full flex flex-col gap-3">
                        <li className="-space-x-2 px-1.5 hidden sm:flex">
                            {subject.characters?.slice(0, 7).map((character, index) => (
                                <TooltipProvider key={character.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={`https://${bangumiUrl}/character/${character.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="relative block touch-manipulation"
                                                style={{ zIndex: 9 - index }}
                                                onPointerDown={(e) => {
                                                    if (e.pointerType !== 'touch') {
                                                        allowState.current = AllowState.Click
                                                    } else if (document.activeElement !== e.currentTarget) {
                                                        allowState.current = AllowState.Preview
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    switch (allowState.current) {
                                                        case AllowState.Preview:
                                                            e.preventDefault()
                                                            allowState.current = AllowState.Click
                                                            break
                                                        case AllowState.Wait:
                                                            e.preventDefault()
                                                        case AllowState.Click:
                                                            allowState.current = AllowState.Wait
                                                            e.currentTarget.blur()
                                                    }
                                                }}
                                            >
                                                <Avatar className="ring-accent/75 ring-3">
                                                    <AvatarImage
                                                        src={character.image}
                                                        alt={character.nameCN || character.name}
                                                    />
                                                    <AvatarFallback>{(character.nameCN || character.name).at(0)}</AvatarFallback>
                                                </Avatar>
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent className="flex flex-col items-center">
                                            <span className="font-medium">{character.nameCN || character.name}</span>
                                            {character.nameCN && character.name && (
                                                <span className="text-[0.5rem] text-muted-foreground">{character.name}</span>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </li>
                        <li className="contents">
                            <ul className="flex gap-1 items-start justify-between min-h-5.5">
                                <li>
                                    {subject.date && (
                                        <Badge variant="secondary" className="bg-accent/60 backdrop-blur-xs font-medium">
                                            <CalendarFold className="mr-0.5" />
                                            {subject.date}
                                        </Badge>
                                    )}
                                </li>
                                <li className="contents">
                                    {(subject.eps ?? 0) > 0 && (
                                        <Badge variant="secondary" className="bg-accent/60 backdrop-blur-xs font-medium hidden sm:inline-flex">
                                            {(subject.type === Category.Anime || subject.type === Category.Real) && <>
                                                <Clapperboard className="mr-0.5" />
                                                {subject.eps} eps
                                            </>}
                                            {(subject.type === Category.Book) && <>
                                                <Book className="mr-0.5" />
                                                {subject.eps} vol
                                            </>}
                                        </Badge>
                                    )}
                                </li>
                            </ul>
                        </li>
                    </ul>
                </figure>
            </ItemHeader>
            <ItemContent className="min-w-0">
                <div className="flex justify-between gap-2">
                    <ItemTitle className="text-lg font-bold line-clamp-1" lang={subject.nameCN ? "zh" : "jp"}>
                        {subject.nameCN || subject.name}
                    </ItemTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => window.open(`https://search.bilibili.com/all?keyword=${encodeURIComponent(subject.nameCN || subject.name)}`, '_blank')}
                                >
                                    <ExternalLink />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>在 <span className="font-medium">bilibili</span> 中打开</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <ItemSeparator />
                <ItemTitle className="text-sm text-muted-foreground line-clamp-1" lang={subject.nameCN ? "ja" : "en"}>{subject.nameCN ? subject.name : "暂无译名"}</ItemTitle>
                <ul className="pt-2 flex w-full flex-wrap gap-2 items-center min-h-30 content-start overflow-hidden">
                    {visibleTags.map(({ name, score, isHighWeight }) => (
                        <li key={name} className="contents">
                            <Badge
                                variant={tagFilter.enable && tagFilter.tags.includes(name) ? "default" : "secondary"}
                                className={cn({
                                    "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/40": debugMenu.enable && debugMenu.tags.highlightHighWeight && isHighWeight,
                                })}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <span>{name}</span>
                                    {debugMenu.enable && debugMenu.sorting.showTagScore && (
                                        <span className={cn(
                                            "rounded-full px-1.5 py-0.5 text-[0.625rem] font-mono leading-none opacity-90",
                                            isHighWeight
                                                ? "bg-amber-500/15 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100"
                                                : "bg-muted text-muted-foreground"
                                        )}>
                                            {score?.toFixed(3) ?? "0.000"}
                                            {isHighWeight ? "*" : ""}
                                        </span>
                                    )}
                                </span>
                                {!tagFilter.tags.includes(name) && (
                                    <Button
                                        variant="ghost"
                                        size="icon-6xs"
                                        className="rounded-full text-muted-foreground hover:text-foreground"
                                        onClick={() => setTagFilter({ ...tagFilter, tags: [...tagFilter.tags, name] })}
                                    >
                                        <Plus />
                                    </Button>
                                )}
                            </Badge>
                        </li>
                    ))}
                    {hiddenTags.length > 0 && (
                        <li className="contents">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-xs text-muted-foreground">
                                        更多 {hiddenTags.length}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-84 max-w-[min(24rem,calc(100vw-2rem))] p-3">
                                    <ul className="flex max-h-80 flex-wrap gap-2 overflow-y-auto pr-1">
                                        {sortedTags.map(({ name, score, isHighWeight }) => (
                                            <li key={name} className="contents">
                                                <Badge
                                                    variant={tagFilter.enable && tagFilter.tags.includes(name) ? "default" : "secondary"}
                                                    className={cn({
                                                        "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/40": debugMenu.enable && debugMenu.tags.highlightHighWeight && isHighWeight,
                                                    })}
                                                >
                                                    <span className="inline-flex items-center gap-1">
                                                        <span>{name}</span>
                                                        {debugMenu.enable && debugMenu.sorting.showTagScore && (
                                                            <span className={cn(
                                                                "rounded-full px-1.5 py-0.5 text-[0.625rem] font-mono leading-none opacity-90",
                                                                isHighWeight
                                                                    ? "bg-amber-500/15 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100"
                                                                    : "bg-muted text-muted-foreground"
                                                            )}>
                                                                {score?.toFixed(3) ?? "0.000"}
                                                                {isHighWeight ? "*" : ""}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {!tagFilter.tags.includes(name) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-6xs"
                                                            className="rounded-full text-muted-foreground hover:text-foreground"
                                                            onClick={() => setTagFilter({ ...tagFilter, tags: [...tagFilter.tags, name] })}
                                                        >
                                                            <Plus />
                                                        </Button>
                                                    )}
                                                </Badge>
                                            </li>
                                        ))}
                                    </ul>
                                </PopoverContent>
                            </Popover>
                        </li>
                    )}
                </ul>
            </ItemContent>
        </Item>
    )
}
