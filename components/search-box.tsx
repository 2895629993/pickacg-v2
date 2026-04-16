"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useQueryStates, parseAsString, parseAsStringLiteral, parseAsJson } from 'nuqs'
import { Search } from "lucide-react"

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"

import { cn } from "@/lib/utils"
import { AirDateMode, Category, Sort } from "@/lib/constants"
import { airDateSchema, formatSearchInput, parseSearchInput, tagSchema } from "@/lib/search-params"
import { type Option } from "@/types/option"

type CategoryValue = typeof Category[keyof typeof Category]
const categoryValues = Object.values(Category)
// Type guard for CategoryValue
function isCategoryValue(value: string): value is CategoryValue {
    return categoryValues.includes(value as CategoryValue)
}
// Options for category select
const categoryOptions: Option[] = [
    {
        value: Category.Anime,
        label: "动画"
    },
    {
        value: Category.Book,
        label: "图书"
    },
    {
        value: Category.Game,
        label: "游戏"
    },
    {
        value: Category.Music,
        label: "音乐"
    },
    {
        value: Category.Real,
        label: "三次元"
    }
] as const

const sortValues = Object.values(Sort)

export function SearchBox({
    className,
    isLoading = false,
    ...props
}: {
    isLoading?: boolean,
} & React.ComponentProps<'form'>) {
    // Sync states with URL query parameters
    const [filters, setFilters] = useQueryStates({
        query: parseAsString.withDefault(''),
        category: parseAsStringLiteral(categoryValues).withDefault(Category.Anime),
        airDate: parseAsJson(airDateSchema),
        sort: parseAsStringLiteral(sortValues).withDefault(Sort.Heat),
        tags: parseAsJson(tagSchema).withDefault({ enable: true, tags: [], excludedTags: [] }),
    })

    const [queryInput, setQueryInput] = React.useState(formatSearchInput({
        query: filters.query,
        tags: filters.tags?.tags ?? [],
        excludedTags: filters.tags?.excludedTags ?? [],
    }))
    const searchParams = useSearchParams()
    React.useEffect(() => {
        setQueryInput(formatSearchInput({
            query: filters.query,
            tags: filters.tags?.tags ?? [],
            excludedTags: filters.tags?.excludedTags ?? [],
        }))
    }, [searchParams, filters.query, filters.tags?.tags, filters.tags?.excludedTags])

    return (
        <form
            className={cn("flex w-full gap-2", className)}
            role="search"
            onSubmit={(e) => {
                e.preventDefault()
                const { query, tags, excludedTags } = parseSearchInput(queryInput)
                setFilters({
                    query,
                    tags: { ...filters.tags, tags, excludedTags },
                    ...(query && { sort: Sort.Match })
                })
            }}
            {...props}
        >
            <Select value={filters.category} onValueChange={(value) => {
                if (isCategoryValue(value)) {
                    setFilters({
                        category: value,
                        airDate: filters.category === Category.Anime && filters.airDate?.mode === AirDateMode.Period
                            ? { ...filters.airDate, season: undefined }
                            : filters.airDate
                    })
                }
            }}>
                <SelectTrigger className="w-[91px] shrink-0 capitalize font-medium">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width] min-w-[--radix-select-trigger-width]">
                    {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="capitalize">
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <InputGroup className="flex-1">
                <InputGroupInput
                    placeholder="搜索..."
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    disabled={isLoading}
                />
                <InputGroupAddon>
                    {isLoading ? <Spinner /> : <Search />}
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                    <InputGroupButton type="submit" variant="secondary" disabled={isLoading}>
                        搜索<Kbd>⏎</Kbd>
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
        </form>
    )
}
