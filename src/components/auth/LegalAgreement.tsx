import Link from 'next/link'
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'

/**
 * The required "I agree" checkbox (signup form and /consent), with the
 * usage-analytics notice as one quiet line beneath it. The documents open
 * in a new tab so a half-filled form isn't lost.
 */
export function LegalAgreement({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="legal-agree">
      <label className="legal-agree__row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
        />
        <span>
          I agree to the{' '}
          <Link href={TERMS_PATH} target="_blank" rel="noopener">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href={PRIVACY_PATH} target="_blank" rel="noopener">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <p className="legal-agree__note">
        We use your activity in Umbrella to improve the program. You can
        change this anytime in Settings.
      </p>
    </div>
  )
}
