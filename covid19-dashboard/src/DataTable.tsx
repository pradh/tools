/**
 Copyright 2020 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import React from 'react';
import chunk from 'lodash/chunk';
import Content from './Content.json';
import Configuration from './Config.json';
import Place from "./Place";
import Th from './Th';
import MultiButtonGroup from "./MultiButtonGroup";
import {getLatestDate, goToPlace} from "./Utils";
import Table from 'react-bootstrap/Table';

type OrientationType = 'desc' | 'asc';

type TableStateType = {
  sortBy: string;
  order: OrientationType;
  chunkIndex: number;
  categories: any[]
};

type TablePropsType = {
  data: Place[];
};

/**
 * The data table with all the essential information.
 * @var state.sortBy: the default sortBy category.
 * @var state.order: display data ascending or descending order
 * @var state.chunkIndex: what chunk of data to display.
 * @param props.data: an object where each key is a geoId
 * and each value contains different timeSeries.
 * The table is divided into pages.
 */
export default class DataTable extends React.Component<
  TablePropsType, TableStateType> {
  state = {
    sortBy: Configuration.tableDefaultSortBy,
    order: 'desc' as OrientationType,
    chunkIndex: 0,
    categories: Content.table
  };

  chunkSize = 30;
  chunkedData: Place[][] = [];

  componentDidMount() {
    // If this is the first time loading the page, store category's status.
    // This way, when the user moves around the dashboard, the checkboxes
    // of the headers will be untouched.
    this.state.categories.forEach(header => {
      if (localStorage[header.id])
        header.enabled = localStorage[header.id] === 'true'
    })
  }

  /**
   * Determines what type of arrow display
   * next to the table's header/category. Or whether none at all.
   * @param sortBy: the observed header/category.
   */
  sortArrow(sortBy: string) {
    // If the input sortBy is the same as the state's sortBy,
    // it means we are actively sorting by that header.
    const active = sortBy === this.state.sortBy;

    if (!active) {
      return '';
    } else if (this.state.order === 'desc') {
      return '▼ ';
    } else if (this.state.order === 'asc') {
      return '▲ ';
    }
  }

  /**
   * When triggered, the current sorting orientation will be changed
   * to the opposite orientation.
   */
  changeOrientation = () => {
    // From ascending to descending.
    // From descending to ascending.
    const opposites = {asc: 'desc', desc: 'asc'};

    // Change the current orientation the opposite orientation.
    const newOrientation = opposites[this.state.order] as OrientationType;
    this.setState({
      order: newOrientation,
    });
  };

  /**
   * When tapping on the header, if the sortBy is already active,
   * then change the orientation, otherwise, change the sortBy
   * to the newly selected header.
   * @param sortBy: the header/category to sort the table by.
   */
  sortBy(sortBy: string) {
    const active = this.state.sortBy === sortBy;

    if (active) {
      this.changeOrientation();
    } else {
      this.setState({sortBy: sortBy});
    }

    // Go back to the first page in the table.
    this.setState({chunkIndex: 0});
  }

  /**
   * Go to a specific page index in the table.
   * @param chunkIndex: the index to navigate to.
   * Corresponds to the table's page - 1.
   */
  setChunkIndex = (chunkIndex: number) => {
    // Make sure our table doesn't go out of boundaries.
    if (chunkIndex >= 0 && chunkIndex < this.chunkedData.length) {
      this.setState({chunkIndex: chunkIndex});
    }
  };

  render() {
    // Sort the data based on the last date in the timeSeries.
    const sortedData = this.props.data.sort((a, b) => {
      const timeSeriesA = a.keyToTimeSeries[this.state.sortBy] || {}
      const timeSeriesB = b.keyToTimeSeries[this.state.sortBy] || {}

      const latestDateA = getLatestDate(Object.keys(timeSeriesA))
      const latestDateB = getLatestDate(Object.keys(timeSeriesB))

      const valueA = timeSeriesA[latestDateA] || 0
      const valueB = timeSeriesB[latestDateB] || 0

      // Descending order
      if (this.state.order === 'desc') {
        return valueB - valueA
      // Ascending order
      } else {
        return valueA - valueB
      }
    })

    // Filter out any values that are nullish.
    const filteredData = sortedData.filter(place => {
      return place.keyToTimeSeries[this.state.sortBy];
    })


    // Chunk the dataset by groups of this.chunkSize.
    // Each element in the chunk represents a row.
    // Each chunk contains this.chunkSize rows.
    this.chunkedData = chunk(filteredData, this.chunkSize);

    // Depending on what page of the table the user is on, display that chunk.
    // Example: If the user is on page 1, display this.chunkedData[0].
    const chunkDataShown = this.chunkedData?.[this.state.chunkIndex] || [];

    // Get the header names from Content.json
    // When the header is clicked, change the sorting.
    const enabledHeaders = this.state.categories.filter(header => header.enabled)

    const tableHeaders = enabledHeaders.map((obj, index) => {
      // Should the title have an arrow?
      const title = this.sortArrow(obj.id) + obj.title;
      return (
        <th onClick={() => this.sortBy(obj.id)}
            key={index}>
          {title}
        </th>
      );
    });

    // Create the data for each row.
    const rows = chunkDataShown.map((place, index) => {
      const tableRanking = this.state.chunkIndex * this.chunkSize + index + 1;

      // For every row, generate a Th for each column.
      const thValues = enabledHeaders.map((category, index) => {
        // Get the timeSeries for our current column's id.
        const timeSeries = place.keyToTimeSeries[category.id] || {};
        return (
          <Th timeSeries={timeSeries}
            typeOf={category.typeOf}
            key={index}
            graphTitle={place.name}
            graphSubtitle={category.graphSubtitle}
            color={category.color}/>
        );
      });

      const subregionType = place.getSubregionType()

      // Place's name in the form of "subregion, region".
      // Example: Miami, Florida.
      let placeFullName = place.name
      if (place.placeType !== 'Country') {
        placeFullName += `, ${place.parentPlace?.name}`;
      }

      return (
        <tbody key={index}>
          <tr className={subregionType ? 'clickable' : ''}
              {...(subregionType && {
                onClick: () => goToPlace(place.geoId, subregionType)})}>
            <th>{tableRanking}</th>
            <th>{placeFullName}</th>
            {thValues}
          </tr>
        </tbody>
      );
    });

    const content = this.state.categories.map(obj => {
      return {id: obj.id, title: obj.title, enabled: obj.enabled}
    })

    return (
      <>
        <HeaderSelector content={content} onClick={(id: string) => {
          const obj = this.state.categories.find(obj => obj.id === id)
          if (obj) {
            const enabled = localStorage[obj.id] === 'true'
            obj.enabled = !enabled
            localStorage[obj.id] = !enabled
          }
          // TODO(edumorales): Use this.setState() instead of forceUpdate.
          // This should be done on re-design of button selection.
          this.forceUpdate()
        }}/>
        <Table responsive="l">
          <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            {tableHeaders}
          </tr>
          </thead>
          {rows}
        </Table>
        <TableIndexPagination
          index={this.state.chunkIndex}
          totalIndexCount={this.chunkedData.length}
          onIndexChange={this.setChunkIndex}
        />
      </>
    );
  }
}


type TableIndexPaginationPropsType = {
  index: number;
  totalIndexCount: number;
  onIndexChange: (index: number) => void;
};


/**
 * Component that displays pagination buttons below the Table.
 * @param props.index: active page.
 * @param props.totalIndexCount: total amount of pages.
 * @param props.onIndexChange: what should happen when the user changes page.
 */
const TableIndexPagination = (props: TableIndexPaginationPropsType) => {
  const MAX_THRESHOLD = 5; // The maximum amount of buttons to display.
  const totalIndexCount = props.totalIndexCount; // How many pages are there?

  // Create an array from 0 to totalIndexCount.
  let indexArray = Array.from(Array(totalIndexCount).keys());

  // If there are more pages than our MAX_THRESHOLD.
  // Slice the array and push the last number in the array.
  // We don't wanna show 100 buttons.
  // Example: [0, 1, 2, 3, 4, 100]
  if (props.totalIndexCount > MAX_THRESHOLD) {
    indexArray = indexArray.slice(0, MAX_THRESHOLD);
    indexArray.push(props.totalIndexCount - 1);
  }

  // For every index in the array, create a button.
  // When clicked, the button will change the index + 1.
  const numberButtons = indexArray.map(index => {
    return {
      active: props.index === index,
      text: String(index + 1),
      onClick: () => props.onIndexChange(index),
    };
  });

  // Previous button object.
  const prevButton = {
    active: props.index !== 0,
    text: 'Previous',
    onClick: () => props.onIndexChange(props.index - 1),
  };

  // Next button object.
  const nextButton = {
    active: props.index !== props.totalIndexCount,
    text: 'Next',
    onClick: () => props.onIndexChange(props.index + 1),
  };

  // Example: Previous 1 2 3 4 Next
  const allButtons = [prevButton, ...numberButtons, nextButton];

  return <MultiButtonGroup items={allButtons} />;
};

type HeaderSelectorProps = {
  content: {title: string, id: string, enabled: boolean}[],
  onClick: (id: string) => void
}

/**
 * Component for the category selectors on top of the table.
 * These are buttons that can be enabled or disabled to
 * add more categories to the table.
 * When a category is added, a new column is created on the table.
 */
const HeaderSelector = (props: HeaderSelectorProps) => {
  return (
    <div className="btn-group-toggle">
    {
        props.content.map(({title, id, enabled}: { title: string, id: string, enabled: boolean }) => {
          const activeClass = enabled ? "btn-secondary" : "btn-outline-dark"
          return (
            <label className={`m-2 btn ${activeClass}`} onClick={() => props.onClick(id)} key={id}>
              <input type="checkbox" checked={enabled} onClick={() => props.onClick(id)}/>
              {title}
            </label>
          )
        })
      }
    </div>
  )
}
