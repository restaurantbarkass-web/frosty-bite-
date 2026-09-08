import { useEffect } from 'react';
import { generateMetadata, MetadataConfig } from '../utils/metadata';

/**
 * React hook to dynamically update page metadata on mount or configuration change.
 * @param config Metadata structure for the page.
 * @param dependencies Optional list of values to monitor and re-configure on alteration.
 */
export function useMetadata(config: MetadataConfig, dependencies: any[] = []) {
  useEffect(() => {
    generateMetadata(config);
  }, dependencies);
}
export default useMetadata;
