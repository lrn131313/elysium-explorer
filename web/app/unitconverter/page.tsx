import { ToolCard, ToolsLayout } from '@/components/tools-layout'
import { UnitConverter } from '@/components/tools-units'
import { COIN } from '@/lib/format'

export const metadata = { title: 'Unit Converter' }

/** Etherscan's Unit Converter, with HYPE (18 decimals on Elysium) where Etherscan has Ether. */
export default function UnitConverterPage() {
  return (
    <ToolsLayout
      active="unitconverter"
      title="Unit Converter"
      intro={`${COIN} is often used in different denominations of its currency, such as Wei for interacting with smart contracts and Gwei for calculating gas prices. Use our Unit Converter to easily convert between them!`}
    >
      <ToolCard>
        <UnitConverter />
      </ToolCard>
    </ToolsLayout>
  )
}
