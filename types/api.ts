export type Subject = {
    id: number
    name: string
    nameCN: string
    type: string
    rating: {
        rank: number
        total: number
        score: number
    }
    nsfw: boolean
    images?: {
        large: string
        medium: string
        common: string
        small: string
        grid: string
    }
    date?: string
    eps?: number
    series?: boolean
    tags?: {
        name: string
        count: number
        score?: number
        isHighWeight?: boolean
    }[]
    characters?: {
        id: number
        name: string
        nameCN?: string
        image?: string
    }[]
    searchMeta?: {
        originalIndex?: number
        sourceChannels?: string[]
        timeScore?: number
        leadingTagScore?: number
        roundedLeadingTagScore?: number
    }
}

export type SearchResponse = {
    data: Subject[]
    total: number
}

export type TrendingResponse = {
    data: {
        subject: Subject
        count: number
    }[]
    total: number
}

export type SearchParam = {
    limit: number
    offset: number
}

export type MultiTagRecallChannel = {
    id: string
    budget: number
    airDate?: string[]
}

export type MultiTagRecallPlan = {
    batchIndex: number
    channels: MultiTagRecallChannel[]
}

export type SearchPayload = {
    keyword: string
    sort: string
    filter: {
        type: number[]
        air_date?: string[]
        rating?: string[]
        tags?: string[]
        rank?: string[]
    }
    sortMeta?: {
        orderedTags?: string[]
        mode?: "multi_tag_count"
        recallPlan?: MultiTagRecallPlan
        debugTagScore?: boolean
        requireFirstTagHighWeight?: boolean
    }
}

export type DetailResponse = {
    [key: string]: {
        id: number
        type: number
        airtime: { date: string }
        eps: number
        volumes: number
        relations: { relation: number }[]
        tags: {
            name: string
            count: number
        }[]
        characters: {
            character: {
                id: number
                name: string
                images?: { grid: string }
                infobox?: {
                    key: string
                    values: {
                        k: string
                        v: string
                    }[]
                }[]
            }
            type: number
        }[]
    }
}

export type TimelineEntry = {
    id: number
    createdAt: number
    memo: { progress?: unknown }
}

export type TimelineResponse = TimelineEntry[]
