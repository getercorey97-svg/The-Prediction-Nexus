/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TennisH2HView } from './TennisH2HView';
import { SportingEvent } from '../types/database';

interface TennisPredictorViewProps {
  events?: SportingEvent[];
  initialMatch?: SportingEvent | null;
}

export const TennisPredictorView: React.FC<TennisPredictorViewProps> = (props) => {
  return <TennisH2HView {...props} />;
};

export { TennisH2HView };
