import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/Button"
import styles from "./BottomNav.module.scss"

/**
 * Back button and progress, pinned to the bottom of every step.
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
		<div className={styles.nav}>
			<div className={styles.nav__inner}>
				<Button
					label={t("back")}
					variant="ghost"
					disabled={isFirstStep}
					data-hidden={isFirstStep || undefined}
					className={styles.nav__back}
					icon={<ArrowLeft size={15} strokeWidth={2} />}
					onClick={onBack}
				/>

				<div className={styles.nav__progress}>
					<div className={styles.nav__count}>
						{t("progress", { current: currentStep, total: totalSteps })}
					</div>
					<div
						className={styles.nav__track}
						role="progressbar"
						aria-valuenow={currentStep}
						aria-valuemin={1}
						aria-valuemax={totalSteps}
					>
						<div
							className={styles.nav__fill}
							style={
								{ "--_nav-progress": `${percentage}%` } as React.CSSProperties
							}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}

export default BottomNav
