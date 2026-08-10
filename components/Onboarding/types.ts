/** Where the tree file is kept. */
export type StorageMode = "default" | "custom"

/** Whether the tree starts with the person setting it up, or with nobody. */
export type StartMode = "me" | "empty"

export interface OnboardingData {
	treeName: string
	storageMode: StorageMode
	/** Absolute path to a `.familytree` folder. Only used when mode is `custom`. */
	customPath: string
	startMode: StartMode
}

/** The steps, in order. `you` is skipped when starting from an empty tree. */
export type StepId = "name" | "storage" | "preferences" | "start" | "you"

export interface StepProps {
	data: OnboardingData
	onUpdate: (updates: Partial<OnboardingData>) => void
	onNext: () => void
	onBack: () => void
}
