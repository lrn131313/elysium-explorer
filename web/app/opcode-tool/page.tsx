import { ToolsLayout } from '@/components/tools-layout'
import { OpcodeTool } from '@/components/tools-opcode'

export const metadata = { title: 'Bytecode to Opcode Disassembler' }

/** Etherscan's Bytecode to Opcode Disassembler; the bytecode is decoded in the browser (lib/opcodes.ts). */
export default function OpcodeToolPage() {
  return (
    <ToolsLayout active="opcode-tool" title="Bytecode to Opcode Disassembler" intro="Attempts to decode the low level Contract Bytecodes to Opcodes.">
      <OpcodeTool />
    </ToolsLayout>
  )
}
