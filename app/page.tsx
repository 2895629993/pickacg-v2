"use client"

import * as React from "react"
import useSWRInfinite from "swr/infinite"
import { SearchSlash, Ban } from "lucide-react"
import { useInView } from "react-intersection-observer"
import { useQueryStates, parseAsJson, parseAsString, parseAsStringLiteral } from "nuqs"

import { ItemGroup } from "@/components/ui/item"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"

import { NavigationBar } from "@/components/navigation-bar"
import { SearchBox } from "@/components/search-box"
import { AdvancedFilter } from "@/components/advanced-filter"
import { SubjectCard } from "@/components/subject-card"
import { SkeletonCard } from "@/components/skeleton-card"
import { ratingSchema, airDateSchema, tagSchema, parseSearchInput } from "@/lib/search-params"
import { Category, Sort, AirDateMode, Season } from "@/lib/constants"
import { MultiTagRecallPlan, SearchParam, SearchPayload, SearchResponse, Subject } from "@/types/api"
import { search } from "@/app/actions"

const pageLimit = 80
const batchLimit = 80
const virtualPageSize = 20
const initialReadyPages = 2
const initialPlaceholderPages = 2
const minRevealDelayMs = 800
const multiTagCandidateLimit = batchLimit

const categoryValues = Object.values(Category)
const sortValues = Object.values(Sort)
const CategoryID = {
    [Category.Anime]: 2,
    [Category.Book]: 1,
    [Category.Game]: 4,
    [Category.Music]: 3,
    [Category.Real]: 6
} as const
const SeasonStart = {
    [Season.Winter]: 1,
    [Season.Spring]: 4,
    [Season.Summer]: 7,
    [Season.Autumn]: 10,
} as const

const quarterMonths = Object.values(SeasonStart)

type SearchKey = {
    params: SearchParam
    payload: SearchPayload
    mergedPageIndex?: number
    yearQuarterTags?: string[]
}

type VirtualPageStatus = "ready" | "loading" | "placeholder"

type VirtualPage = {
    index: number
    status: VirtualPageStatus
    items: Subject[]
    revealed: boolean
    isBuffered: boolean
}

function getMultiTagPageCount(items: Subject[]) {
    return Math.ceil(items.length / virtualPageSize)
}

function getPlaceholderPageCount({
    revealedPages,
    loadedPages,
    hasMoreBatches,
}: {
    revealedPages: number
    loadedPages: number
    hasMoreBatches: boolean
}) {
    const hiddenLoadedPages = Math.max(loadedPages - revealedPages, 0)
    const bufferedPages = Math.min(hiddenLoadedPages, initialPlaceholderPages)

    if (bufferedPages > 0) {
        return bufferedPages
    }

    return hasMoreBatches ? initialPlaceholderPages : 0
}

type MultiTagBatchResponse = SearchResponse & {
    batchIndex: number
}

function buildMultiTagRecallPlan(nowYear: number, batchIndex: number): MultiTagRecallPlan {
    const baseYear = nowYear - (batchIndex * 3)

    return {
        batchIndex,
        channels: [
            {
                id: `current-${baseYear}`,
                budget: 20,
                airDate: [`>=${baseYear}-01-01`, `<${baseYear + 1}-01-01`],
            },
            {
                id: `near-${baseYear - 1}-${baseYear + 1}`,
                budget: 28,
                airDate: [`>=${baseYear - 1}-01-01`, `<${baseYear + 2}-01-01`],
            },
            {
                id: `fallback-${batchIndex}`,
                budget: 32,
            },
        ],
    }
}

function mergeSearchResponses(responses: SearchResponse[], mergedPageIndex = 0): SearchResponse {
    const uniqueSubjects = new Map<number, SearchResponse["data"][number]>()

    for (const response of responses) {
        for (const subject of response.data) {
            if (!uniqueSubjects.has(subject.id)) {
                uniqueSubjects.set(subject.id, subject)
            }
        }
    }

    const mergedSubjects = Array.from(uniqueSubjects.values())
    const pageStart = mergedPageIndex * pageLimit
    const pageData = mergedSubjects.slice(pageStart, pageStart + pageLimit)

    return {
        data: pageData,
        total: pageStart + pageData.length + (pageData.length === pageLimit ? 1 : 0),
    }
}

function rankMultiTagSubjects(subjects: Subject[], orderedTags: string[]): Subject[] {
    const leadingTag = orderedTags[0]

    return [...subjects].sort((a, b) => {
        const timeA = a.searchMeta?.timeScore ?? Number.NEGATIVE_INFINITY
        const timeB = b.searchMeta?.timeScore ?? Number.NEGATIVE_INFINITY
        if (timeA !== timeB) { return timeB - timeA }

        const tagA = a.searchMeta?.roundedLeadingTagScore ?? 0
        const tagB = b.searchMeta?.roundedLeadingTagScore ?? 0
        if (tagA !== tagB) { return tagB - tagA }

        if (a.rating.score !== b.rating.score) { return b.rating.score - a.rating.score }

        const rankA = a.rating.rank > 0 ? a.rating.rank : Number.POSITIVE_INFINITY
        const rankB = b.rating.rank > 0 ? b.rating.rank : Number.POSITIVE_INFINITY
        if (rankA !== rankB) { return rankA - rankB }

        const hasLeadingA = leadingTag ? Boolean(a.tags?.find((tag) => tag.name === leadingTag)?.isHighWeight) : false
        const hasLeadingB = leadingTag ? Boolean(b.tags?.find((tag) => tag.name === leadingTag)?.isHighWeight) : false
        if (hasLeadingA !== hasLeadingB) { return hasLeadingA ? -1 : 1 }

        return (a.searchMeta?.originalIndex ?? Number.MAX_SAFE_INTEGER) - (b.searchMeta?.originalIndex ?? Number.MAX_SAFE_INTEGER)
    })
}

async function fetchMultiTagBatch(key: SearchKey): Promise<MultiTagBatchResponse> {
    const recallPlan = key.payload.sortMeta?.recallPlan
    const orderedTags = key.payload.sortMeta?.orderedTags?.filter(Boolean) ?? []
    const nowYear = new Date().getFullYear()
    const channels = recallPlan?.channels ?? [{ id: "fallback-0", budget: batchLimit }]

    const responses = await Promise.all(channels.map(async (channel) => {
        const response = await search({
            params: {
                limit: channel.budget,
                offset: 0,
            },
            payload: {
                ...key.payload,
                filter: {
                    ...key.payload.filter,
                    ...(channel.airDate ? { air_date: channel.airDate } : {}),
                },
            },
        })

        return response.data.map((subject, index) => ({
            ...subject,
            searchMeta: {
                ...subject.searchMeta,
                originalIndex: index,
                sourceChannels: [channel.id],
                timeScore: subject.date
                    ? 100 - Math.abs(parseInt(subject.date.slice(0, 4)) - nowYear)
                    : Number.NEGATIVE_INFINITY,
                leadingTagScore: orderedTags[0]
                    ? (subject.tags?.find((tag) => tag.name === orderedTags[0])?.score ?? 0)
                    : 0,
                roundedLeadingTagScore: orderedTags[0]
                    ? Math.round(((subject.tags?.find((tag) => tag.name === orderedTags[0])?.score ?? 0) * 10)) / 10
                    : 0,
            },
        }))
    }))

    const mergedSubjects = new Map<number, Subject>()
    for (const subjects of responses) {
        for (const subject of subjects) {
            const existing = mergedSubjects.get(subject.id)
            if (!existing) {
                mergedSubjects.set(subject.id, subject)
                continue
            }

            mergedSubjects.set(subject.id, {
                ...existing,
                searchMeta: {
                    ...existing.searchMeta,
                    sourceChannels: Array.from(new Set([
                        ...(existing.searchMeta?.sourceChannels ?? []),
                        ...(subject.searchMeta?.sourceChannels ?? []),
                    ])),
                },
            })
        }
    }

    const ranked = rankMultiTagSubjects(Array.from(mergedSubjects.values()), orderedTags, nowYear)
    const pageStart = (recallPlan?.batchIndex ?? 0) * batchLimit
    const pageData = ranked.slice(pageStart, pageStart + batchLimit)

    return {
        data: pageData,
        total: pageStart + pageData.length + (pageData.length === batchLimit ? 1 : 0),
        batchIndex: recallPlan?.batchIndex ?? 0,
    }
}

const fetcher = async (key: SearchKey) => {
    if (key.payload.sortMeta?.mode === Sort.MultiTagCount) {
        return fetchMultiTagBatch(key)
    }

    if (key.yearQuarterTags?.length) {
        const baseTags = key.payload.filter.tags?.filter((existingTag) => !key.yearQuarterTags?.includes(existingTag)) ?? []
        const quarterParams: SearchParam = {
            ...key.params,
            offset: 0,
            limit: ((key.mergedPageIndex ?? 0) + 1) * pageLimit,
        }

        return mergeSearchResponses(await Promise.all(
            key.yearQuarterTags.map((tag) => search({
                params: quarterParams,
                payload: {
                    ...key.payload,
                    filter: {
                        ...key.payload.filter,
                        tags: [
                            ...baseTags,
                            tag,
                        ],
                    },
                },
            }))
        ), key.mergedPageIndex)
    }

    return await search(key)
}

export default function Home() {
    const now = React.useMemo(() => new Date(), [])

    // Sync filters with URL query parameters
    const [filters] = useQueryStates({
        query: parseAsString.withDefault(''),
        category: parseAsStringLiteral(categoryValues).withDefault(Category.Anime),
        sort: parseAsStringLiteral(sortValues).withDefault(Sort.Heat),

        airDate: parseAsJson(airDateSchema).withDefault({
            enable: false,
            mode: AirDateMode.Period,
            year: now.getFullYear(),
        }),

        rating: parseAsJson(ratingSchema).withDefault({
            enable: false,
            min: 6,
            max: 8,
        }),

        tags: parseAsJson(tagSchema).withDefault({
            enable: true,
            tags: [],
            excludedTags: [],
        }),
    })

    const { query, tags: inlineTags, excludedTags: inlineExcludedTags } = parseSearchInput(filters.query)
    const structuredTags = filters.tags?.tags ?? []
    const periodAirDate = filters.airDate.enable && filters.airDate.mode === AirDateMode.Period
        ? filters.airDate
        : null
    const excludedTags = React.useMemo(() => [...new Set([
        ...(filters.tags.enable
            ? (filters.tags?.excludedTags ?? [])
            : []),
        ...inlineExcludedTags,
    ])], [filters.tags, inlineExcludedTags])
    const excludedTagSet = React.useMemo(() => new Set(excludedTags), [excludedTags])

    const getKey = (pageIndex: number, previousPageData: SearchResponse | null) => {
        const isMultiTagSort = filters.sort === Sort.MultiTagCount
        const currentPageLimit = isMultiTagSort
            ? multiTagCandidateLimit
            : pageLimit
        const recallPlan = isMultiTagSort
            ? buildMultiTagRecallPlan(now.getFullYear(), pageIndex)
            : undefined
        if (previousPageData && previousPageData.total <= pageIndex * currentPageLimit) { return null }

        const airDate = filters.airDate.enable && filters.airDate.mode === AirDateMode.Range
            ? [
                filters.airDate.from ? `>=${filters.airDate.from}` : null,
                filters.airDate.to ? `<=${filters.airDate.to}` : null
            ].filter((val) => val !== null)
            : []
        const rating = filters.rating.enable
            ? [`>=${filters.rating.min}`, `<=${filters.rating.max}`]
            : []
        const yearQuarterTags = periodAirDate &&
            filters.category === Category.Anime &&
            !periodAirDate.season
            ? quarterMonths.map((month) => `${periodAirDate.year}年${month}月`)
            : undefined
        const tags = [...new Set([
            ...(periodAirDate
                ? [filters.category === Category.Anime
                    ? (periodAirDate.season
                        ? `${periodAirDate.year}年${SeasonStart[periodAirDate.season]}月`
                        : `${periodAirDate.year}年1月`)
                    : periodAirDate.year.toString()]
                : []),
            ...(filters.tags.enable
                ? structuredTags
                : []),
            ...inlineTags,
        ])].filter((tag) => !excludedTagSet.has(tag))
        const orderedTags = [...new Set([
            ...inlineTags,
            ...(filters.tags.enable
                ? structuredTags
                : []),
        ])].filter((tag) => !excludedTagSet.has(tag))
        const rank = filters.sort === Sort.Rank ? [">0"] : []
        const upstreamSort = filters.sort === Sort.MultiTagCount
            ? Sort.Match
            : filters.sort

        const params: SearchParam = {
            limit: currentPageLimit,
            offset: (pageIndex * currentPageLimit),
        }
        const payload: SearchPayload = {
            keyword: query,
            sort: upstreamSort,
            filter: {
                type: [CategoryID[filters.category]],
                ...(tags.length > 0 && { tags: tags }),
                ...(airDate.length > 0 && { air_date: airDate }),
                ...(rating.length > 0 && { rating: rating }),
                ...(rank.length > 0 && { rank: rank }),
            },
            ...((orderedTags.length > 0 || filters.sort === Sort.MultiTagCount) && {
                sortMeta: {
                    ...(orderedTags.length > 0 && { orderedTags }),
                    ...(filters.sort === Sort.MultiTagCount && { mode: Sort.MultiTagCount, recallPlan }),
                },
            }),
        }
        return { params, payload, mergedPageIndex: pageIndex, yearQuarterTags }
    }
    const { data, error, isLoading, size, setSize } = useSWRInfinite<SearchResponse>(getKey, fetcher)
    const isMultiTagSort = filters.sort === Sort.MultiTagCount
    const [revealedVirtualPages, setRevealedVirtualPages] = React.useState(initialReadyPages)
    const [loadingRevealPage, setLoadingRevealPage] = React.useState<number | null>(null)

    React.useEffect(() => {
        setRevealedVirtualPages(initialReadyPages)
        setLoadingRevealPage(null)
    }, [filters.query, filters.category, filters.sort, filters.airDate, filters.rating, filters.tags])

    const { ref, inView } = useInView({ rootMargin: '100px' })

    const firstPage = data?.at(0)
    const filteredResults = React.useMemo(() => data?.flatMap((page) =>
        page.data
            // exclude mismatches by air date
            .filter((subject) => periodAirDate
                ? (filters.category === Category.Anime
                    ? (periodAirDate.season
                        ? [`${periodAirDate.year}年${SeasonStart[periodAirDate.season]}月`]
                        : quarterMonths.map((month) => `${periodAirDate.year}年${month}月`))
                    : [periodAirDate.year.toString(), `${periodAirDate.year}年`])
                    .includes(subject.tags?.find((tag) => filters.category === Category.Anime
                        ? /^\d{4}年\d{1,2}月$/.test(tag.name)
                        : /^\d{4}(年)?$/.test(tag.name))?.name ?? "")
                : subject)
            // exclude non-series books
            .filter((subject) => !subject.tags?.some((subjectTag) => excludedTagSet.has(subjectTag.name)))
            .filter((subject) => filters.category !== Category.Book || subject.series)
    ) ?? [], [data, periodAirDate, filters.category, excludedTagSet])
    const suggestedTags = (() => {
        if (!firstPage?.data || firstPage.data.length === 0) { return [] }

        return Array.from(
            firstPage.data
                .filter((subject) => !subject.tags?.some((subjectTag) => excludedTagSet.has(subjectTag.name)))
                .flatMap((subject) => subject.tags ?? [])
                .reduce((acc, tag) => acc.set(tag.name, (acc.get(tag.name) || 0) + tag.count), new Map<string, number>()))
            // filter out tags that are too long
            .filter(([name]) => name && name.length < 16)
            // filter out tags that are too common
            .filter(([name]) => !(filters.category === Category.Anime && ["TV", "日本"].includes(name)))
            .filter(([name]) => !excludedTagSet.has(name))
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 10)
            .map(([name]) => name)
    })()
    const multiTagLoadedPages = React.useMemo(() => getMultiTagPageCount(filteredResults), [filteredResults])
    const multiTagVisibleReadyPages = Math.min(revealedVirtualPages, multiTagLoadedPages)
    const multiTagHasMoreBatches = isMultiTagSort
        ? ((data?.at(-1)?.data.length ?? 0) === batchLimit)
        : false
    const multiTagPlaceholderPages = isMultiTagSort
        ? getPlaceholderPageCount({
            revealedPages: multiTagVisibleReadyPages,
            loadedPages: multiTagLoadedPages,
            hasMoreBatches: multiTagHasMoreBatches,
        })
        : 0
    const multiTagVisiblePages = isMultiTagSort
        ? (multiTagVisibleReadyPages + multiTagPlaceholderPages)
        : 0

    React.useEffect(() => {
        if (!inView || isLoading) { return }

        if (isMultiTagSort) {
            const nextPage = multiTagVisibleReadyPages + 1
            const hasBufferedPageToReveal = multiTagLoadedPages > multiTagVisibleReadyPages

            if (hasBufferedPageToReveal && loadingRevealPage === null) {
                const startedAt = Date.now()
                setLoadingRevealPage(nextPage)
                const timer = window.setTimeout(() => {
                    const elapsed = Date.now() - startedAt
                    const remain = Math.max(0, minRevealDelayMs - elapsed)
                    window.setTimeout(() => {
                        setRevealedVirtualPages((prev) => Math.max(prev, nextPage))
                        setLoadingRevealPage(null)
                    }, remain)
                }, 0)

                return () => window.clearTimeout(timer)
            }

            const remainingBufferedPages = Math.max(multiTagLoadedPages - multiTagVisibleReadyPages, 0)
            const shouldPrefetchNextBatch = loadingRevealPage === null
                && multiTagHasMoreBatches
                && remainingBufferedPages <= 1
                && size === (data?.length ?? 0)

            if (shouldPrefetchNextBatch) {
                setSize((prev) => prev + 1)
            }
            return
        }

        setSize((prev) => prev + 1)
    }, [
        inView,
        isLoading,
        isMultiTagSort,
        loadingRevealPage,
        multiTagHasMoreBatches,
        multiTagLoadedPages,
        multiTagVisibleReadyPages,
        data?.length,
        setSize,
        size,
    ])

    const multiTagVirtualPages = React.useMemo(() => {
        if (!isMultiTagSort) { return [] as VirtualPage[] }

        const pages: VirtualPage[] = []

        for (let pageIndex = 0; pageIndex < multiTagVisiblePages; pageIndex++) {
            const pageNumber = pageIndex + 1
            const pageItems = filteredResults.slice(pageIndex * virtualPageSize, (pageIndex + 1) * virtualPageSize)
            const isRevealed = pageNumber <= multiTagVisibleReadyPages
            const isLoadingPage = loadingRevealPage === pageNumber
            const isBuffered = !isRevealed && pageItems.length > 0
            const status: VirtualPageStatus = isRevealed
                ? (isLoadingPage ? "loading" : "ready")
                : (isLoadingPage
                    ? "loading"
                    : "placeholder")

            pages.push({
                index: pageNumber,
                status,
                items: isRevealed ? pageItems : [],
                revealed: isRevealed,
                isBuffered,
            })
        }

        return pages
    }, [filteredResults, isMultiTagSort, loadingRevealPage, multiTagVisiblePages, multiTagVisibleReadyPages])

    const reachedEnd = isMultiTagSort
        ? (!isLoading
            && loadingRevealPage === null
            && !multiTagHasMoreBatches
            && multiTagVisibleReadyPages >= multiTagLoadedPages)
        : (!isLoading && data && data.length && data.at(-1)!.total <= (data.length - 1) * pageLimit + data.at(-1)!.data.length)

    return (
        <div className="flex min-h-screen items-center justify-center font-sans">
            <main className="flex min-h-screen w-full max-w-400 flex-col items-center gap-6 py-2 px-4 sm:py-6 sm:px-12 sm:items-start">
                <NavigationBar />
                <SearchBox isLoading={isLoading} />
                <AdvancedFilter
                    suggestedTags={suggestedTags.filter((tag) => tag && !(filters.category === Category.Anime
                        ? /^\d{4}年(\d{1,2}月)?$/.test(tag)
                        : /^\d{4}(年)?$/.test(tag)
                    ))}
                    isLoading={isLoading}
                />
                <ItemGroup className="grid w-full gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {isMultiTagSort
                        ? multiTagVirtualPages.flatMap((page) => {
                            if (page.status === "ready") {
                                return page.items.map((subject) => (<SubjectCard key={subject.id} subject={subject} />))
                            }

                            if (page.status === "loading" || page.status === "placeholder") {
                                const skeletonCount = page.isBuffered
                                    ? Math.max(page.items.length, 1)
                                    : virtualPageSize

                                return Array.from({ length: skeletonCount }, (_, index) => (
                                    <SkeletonCard key={`virtual-page-${page.index}-${index}`} />
                                ))
                            }

                            return []
                        })
                        : filteredResults.map((subject) => (<SubjectCard key={subject.id} subject={subject} />))}
                    {!isMultiTagSort && (size > (data?.length ?? 0)) && !reachedEnd && (
                        Array.from({ length: pageLimit }, (_, index) => (
                            <SkeletonCard key={`skeleton-${index}`} />
                        ))
                    )}
                </ItemGroup>
                {!reachedEnd && size === (data?.length ?? 0) && <div ref={ref} />}
                <Empty className="w-full">
                    {reachedEnd && data.at(-1)?.total === 0 && (
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <SearchSlash />
                            </EmptyMedia>
                            <EmptyTitle>暂无结果</EmptyTitle>
                            <EmptyDescription>
                                可以尝试调整搜索条件
                            </EmptyDescription>
                        </EmptyHeader>
                    )}
                    {error && (
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Ban />
                            </EmptyMedia>
                            <EmptyTitle>出错了</EmptyTitle>
                            <EmptyDescription>
                                加载内容时发生了意外错误
                            </EmptyDescription>
                        </EmptyHeader>
                    )}
                </Empty>
            </main>
        </div>
    )
}
