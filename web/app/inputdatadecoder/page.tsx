import { Beta, ToolsLayout } from '@/components/tools-layout'
import { InputDataDecoder } from '@/components/tools-decoder'

export const metadata = { title: 'Input Data Decoder' }

/** Etherscan's Input Data Decoder; the decoding runs in the browser (lib/tools-abi.ts), lookups go through ./tx, ./abi, ./signatures. */
export default function InputDataDecoderPage() {
  return (
    <ToolsLayout
      active="inputdatadecoder"
      title={
        <>
          Input Data Decoder <Beta />
        </>
      }
      intro="Interpret and analyze data sent to Elysium smart contracts."
    >
      <InputDataDecoder />
    </ToolsLayout>
  )
}
