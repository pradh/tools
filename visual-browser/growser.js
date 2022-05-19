let API_ROOT = 'https://api.datacommons.org';
let all_nodes = new Set();
let cid_stat = [[]];
let limit = '50';

var network;

function getTarget(id, type, prop) {
  let tgt = API_ROOT + '/node/' + type + '?dcids=' + id;
  if (prop) {
    tgt += '&property=' + prop + "&limit=" + limit;
  }
  console.log('Querying : ' + tgt);
  return tgt;
}

function trunc(str) {
  let nstr = str.replace(/^https:\/\/www\./, '')
    .replace(/^http:\/\/www\./, '')
    .replace(/^https:\/\//, '')
    .replace(/^http:\/\//, '');
  if (nstr.length > 15) {
    return nstr.substr(0, 15) + '...';
  }
  return nstr;
}

function ripHubHack(str) {
  // HACK alert: strip label prefix.
  return str.replace(/^.*::/, '');
}

function arcWidth(narcs) {
  if (narcs < 100) {
    return 1;
  } else if (narcs > 1000) {
    return 10;
  } else {
    return narcs / 100;
  }
}

function draw(id, labels, arcGrps) {
  if (network != null) {
    network.destroy();
    network = null;
  }
  all_nodes.clear();
  let node_data = [];
  let edge_data = [];
  let added_nodes = new Set();
  let added_edges = new Set();
  let cidnext = 0;
  let node_name = id;
  for (let i = 0; i < arcGrps.length; i++) {
    let grp = arcGrps[i];
    let label = labels[i];
    for (let dir of ['in', 'out']) {
      if (!(dir in grp)) {
        continue;
      }

      narcs = grp[dir].length;
      hubId = '';
      cid = -1;
      if (dir == 'in' && narcs > 1) {
        hubId = id + '-' + dir + '-' + label;
        hubEdgeId = hubId + '-edge';
        cid = cidnext++;
        cid_stat.push([]);
        if (!added_nodes.has(hubId)) {
          node_data.push({
            id: hubId,
            label: label,
            color: 'lightblue',
            shape: 'circle',
            shadow: { enabled: true },
            cid: cid
          });
          added_nodes.add(hubId);
        }
        if (!added_edges.has(hubEdgeId)) {
          edge_data.push({
            id: hubEdgeId,
            from: hubId,
            to: id,
            label: label,
            width: arcWidth(narcs), 
            color: 'black',
            arrows: 'to',
          });
          added_edges.add(hubEdgeId);
        }
      }
      for (let j = 0; j < grp[dir].length; j++) {
        let arc = grp[dir][j];

        // Name is treated specially.
        if (label == 'name' && 'value' in arc && !added_nodes.has(id)) {
          node_data.push({
            id: id,
            label: arc['value'],
            title: arc['value'],
            shape: 'box',
            shadow: { enabled: true },
            color: 'lightgreen'
          });
          node_name = arc['value'];
          added_nodes.add(id);
          break;
        }

        // Deal with "other" node.
        if ('dcid' in arc) {
          isLeaf = false;
          // Hack alert: prefix label to avoid the case where there is an
          // edge across two hubs.
          if (hubId != '') {
            other = label + '::' + arc['dcid'];
          } else {
            other = arc['dcid'];
          }
          all_nodes.add(other);
          if ('name' in arc) {
            name = arc['name'];
          } else {
            name = arc['dcid'];
          }
        } else {
          isLeaf = true;
          other = '"' + arc['value'] + '"';
          name = arc['value'];
        }
        if (id != other && !added_nodes.has(other)) {
          if (dir === 'in' && cid >= 0) {
            cid_stat[cid].push(ripHubHack(other));
          }
          if (isLeaf) {
            node_data.push({
              id: other,
              label: '"' + trunc(name) + '"',
              title: name,
              shape: 'text',
              shadow: { enabled: true },
              size: 8,
              color: 'gray',
              cid: cid
            });
          } else {
            node_data.push({
              id: other,
              label: trunc(name),
              title: name,
              shape: 'box',
              shadow: { enabled: true },
              color: 'lightblue',
              cid: cid
            });
          }
          added_nodes.add(other);
        }

        // Deal with the link.
        edge = id + '-' + dir + '-' + label + '-' + other;
        if (!added_edges.has(edge)) {
          if (dir === 'in') {
            edge_data.push({
              id: edge,
              from: other,
              to: (hubId != '' ? hubId : id),
              label: label,
              color: 'black',
              arrows: 'to',
            });
          } else {
            edge_data.push({
              id: edge,
              from: id,
              to: other,
              label: label,
              color: 'black',
              arrows: 'to',
            });
          }
          added_edges.add(edge);
        }
      }  // arc of grp[dir]
    }  // dir in ['in', 'out']
  }  // i in arcGrps

  if (!added_nodes.has(id)) {
    // Node has no name.
    node_data.push({
      id: id,
      label: id,
      title: id,
      shape: 'box',
      shadow: { enabled: true },
      color: 'lightgreen'
    });
  }

  let nodes = new vis.DataSet(node_data);
  let edges = new vis.DataSet(edge_data);

  // Create a network
  document.getElementById('about-node').innerHTML = 'About: ' + node_name;

  let container = document.getElementById('graph');
  let data = {nodes: nodes, edges: edges};
  let options = {
    physics: {
      stabilization: { iterations: 10 },
      solver: 'forceAtlas2Based',
    },
    layout: {
      improvedLayout: false
    },
    interaction: {
      navigationButtons: true
    }
  };
  network = new vis.Network(container, data, options);
  network.focus(id);

  for (let i = 0; i < cidnext; i++) {
    if (cid_stat[i].length == 1) {
      continue;
    }
    let title = '';
    for (let j = 0; j < cid_stat[i].length; j++) {
      if (j > 4) {
        title += ', ...';
        break;
      }
      if (title == '') {
        title = cid_stat[i][j];
      } else {
        title += ', ' + cid_stat[i][j];
      }
    }

    let copts = {
      joinCondition: function(nodeOptions) {
        return nodeOptions.cid === i;
      },
      clusterNodeProperties: {
        shape: 'box',
        shadow: { enabled: true },
        label: cid_stat[i].length + ' Nodes',
        title: title
      }
    };
    network.clustering.cluster(copts);
  }

  network.on('doubleClick', function(param) {
    let node = this.getNodeAt(param.pointer.DOM);
    console.log('Clicked on DOM node: ' + node);
    if (!node || typeof node != 'string') {
      return;
    }
    if (all_nodes.has(node)) {
      node = ripHubHack(node);
      window.location.href = '?&dcid=' + node + '&limit=' + limit;
    } else if (node.startsWith('cluster:')) {
      network.openCluster(node);
    }
  });
}

async function processLabels(id, respPromise) {
  let resp = await respPromise;
  let labelResp = JSON.parse(resp.payload)[id];
  let promises = [];
  let labels = [];
  let seenLabels = new Set();
  for (type of ['inLabels', 'outLabels']) {
    if (!(type in labelResp)) {
      continue;
    }
    for (label of labelResp[type]) {
      if (label === 'kmlCoordinates') {
        continue;
      }
      if (label in seenLabels) {
        continue;
      }
      seenLabels.add(label);
      labels.push(label);
      promises.push(fetch(getTarget(id, 'property-values', label))
        .then(resp => resp.json()));
    }
  }
  Promise.all(promises).then(async function(results) {
    let arcGrps = []
    for (let i = 0; i < results.length; i++) {
      let res = await results[i];
      arcGrps.push(JSON.parse(res.payload)[id]);
    }
    draw(id, labels, arcGrps);
  });
}

function refresh(id) {
  let searchParams = new URLSearchParams(window.location.search);
  console.log('Looking for ' + id);
  fetch(getTarget(id, 'property-labels'))
    .then(resp => resp.json())
    .then(jresp => processLabels(id, jresp));
}

function reload() {
  let searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has('limit')) {
    limit = searchParams.get('limit');
  } else {
    limit = '50';
  }
  if (searchParams.has('dcid')) {
    refresh(searchParams.get('dcid'));
  } else {
    window.location.href = '?&dcid=geoId/06&limit=' + limit;
  }
}

window.addEventListener('load', reload);
window.addEventListener('hashchange', reload);
