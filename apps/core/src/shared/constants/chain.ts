
export enum CHAIN_ID {
    SONEIUM = "1868",
    SONIC = "146"
}

export const SUPPORTED_CHAIN_IDS = Object.values(CHAIN_ID)

export const CHAIN_NAME: Record<CHAIN_ID, string> = {
    [CHAIN_ID.SONEIUM]: "Soneium",
    [CHAIN_ID.SONIC]: "Sonic",
}