import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"

/**
 * Back button and progress, pinned to the bottom of every step.
 *
 * `bg-panel-veil` rather than a translucent white: the veil token is already a
 * theme-aware near-opaque panel colour, so the bar reads correctly over the
 * page in dark mode too.
 */

interface BottomNavProps {
	onBack: () => void
	isFirstStep: boolean
	currentStep: number
	totalSteps: number
}

export function BottomNav({
	onBack,
	isFirstStep,
	currentStep,
	totalSteps,
}: BottomNavProps) {
	const t = useTranslations("onboarding")
	const percentage = (currentStep / totalSteps) * 100

	return (
		<div className="sticky bottom-0 border-line border-t bg-panel-veil px-6 py-4 backdrop-blur">
			<div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
				<button
					type="button"
					onClick={onBack}
					disabled={isFirstStep}
					className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-sm ${
						isFirstStep
							? "pointer-events-none opacity-0"
							: "text-ink-muted hover:bg-wash hover:text-ink"
					}`}
				>
					<ArrowLeft size={15} strokeWidth={2} />
					{t("back")}
				</button>

				<div className="flex flex-col items-end gap-1.5">
					<div className="font-medium text-ink-muted text-xs">
						{t("progress", { current: currentStep, total: totalSteps })}
					</div>
					<div
						className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuenow={currentStep}
						aria-valuemin={1}
						aria-valuemax={totalSteps}
					>
						<div
							className="h-full rounded-full bg-root-ink transition-all duration-500 ease-out"
							style={{ width: `${percentage}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}

export default BottomNav
