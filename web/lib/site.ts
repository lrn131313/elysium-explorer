// Brand + chain constants in one place. The name is a working title until the owner picks one.
export const SITE = {
  name: 'Elysium Explorer',
  shortName: 'Elysium',
  tagline: 'The Elysium Blockchain Explorer',
  chainName: 'Elysium',
  chainId: 99901,
  parentChain: 'HyperEVM',
  /** Where the HyperEVM side of a bridge message (its block, transaction, sender) is shown, as Arbiscan links Etherscan. */
  parentExplorer: 'https://hyperevmscan.io',
  coin: 'HYPE',
  about:
    'An independent block explorer for Elysium, the Arbitrum Orbit chain that settles on HyperEVM. Data comes from our own archive node.',
} as const
