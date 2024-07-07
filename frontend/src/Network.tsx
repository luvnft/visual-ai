import React, {useEffect, useState} from "react";
import {DefaultNode, Graph} from "@visx/network";
import {NetworkProps} from "./interface/NetworkProps";
import {addLayer, remove_layer} from "./api";
import {Box} from "@mui/material";
import Epoch from "./epoch";
import {CustomLink} from "./interface/CustomLink";
import {CustomNode} from "./interface/CustomNode";
import {Weights} from "./interface/WeightObject";
import {GraphProps} from "./interface/GraphProps";

const setBackend = async (layerPerceptronMap: Map<number, number>) => {
  let r;
  console.log("layersMap", layerPerceptronMap)
  for (const [layer, perceptrons] of layerPerceptronMap.entries()) {
    r = addLayer(perceptrons, "sigmoid")
  }
  return r
}

const resetBackend = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await remove_layer();
      if (res.message === "Layer is empty") {
        break;
      }
    } catch (error) {
      console.error('Error removing layer:', error);
    }
  }
}

const updateEdgeValue = (edges: CustomLink[], weights: Weights): CustomLink[] => {
  const newEdges = edges.map((edge, index) => {
    // Frontend layer indices are 1, 2, 3; backend layers are 0, 1
    // Mapping frontend layer indices to backend layer indices
    const sourceLayer = Number(edge.sourceLayer) - 1;
    const targetLayer = Number(edge.targetLayer) - 1;
    const sourceIndex = Number(edge.sourceIndex);
    const targetIndex = Number(edge.targetIndex);

    // Form the keys for the source layer and perceptron
    const sourceLayerKey = `layer ${sourceLayer}`;
    const perceptronKey = `perceptron ${targetIndex}`;

    // Debug log to ensure each iteration is processed
    console.log(`Processing edge ${index}:`, { sourceLayer, targetLayer, sourceIndex, targetIndex });
    console.log(sourceLayerKey, perceptronKey, sourceIndex);

    // Check if the source layer and perceptron exist in weights
    if (weights[sourceLayerKey] && weights[sourceLayerKey][perceptronKey]) {
      // Get the weight corresponding to the target index
      const weight = weights[sourceLayerKey][perceptronKey].weights[sourceIndex];
      console.log(`Weight found: ${weight}`);
      // Update the edge value
      return { ...edge, value: weight };
    }

    // If weight not found, return the edge as it is
    return { ...edge };
  });

  console.log(`Total newEdges length: ${newEdges.length}`);
  console.log("newEdges", newEdges);
  return newEdges;
};

const updateNodeValue = (nodes: CustomNode[], weights: Weights): CustomNode[] => {
  const newNodes = nodes.map(node => {
    const layer = node.layer
    const index = node.index

    const layerKey = `layer ${layer - 1}`;
    const perceptronKey = `perceptron ${index}`;

    //@ts-ignore
    if (layer == 0) {
      node.value = 1
    }
    else if (layer > 0 && weights[layerKey] && weights[layerKey][perceptronKey]) {
      node.value = weights[layerKey][perceptronKey].bias
    } else {
      console.error(`Invalid layer index: ${layerKey}`)
    }

    return { ...node}
  });

  return newNodes;
}

const adjustColorIntensity = (color: string, value: number) => {
  // Ensure value is between 0 and 1
  const intensity = Math.min(1, 0.5 + value);

  // Parse the hex color
  const hex = color.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust intensity
  const adjust = (channel: number) => Math.round(channel * intensity);

  // Convert back to hex
  const newR = adjust(r).toString(16).padStart(2, '0');
  const newG = adjust(g).toString(16).padStart(2, '0');
  const newB = adjust(b).toString(16).padStart(2, '0');

  return `#${newR}${newG}${newB}`;
};

export default function Network({
  width,
  height,
  layerPerceptronMap,
  weights,
  epoch
}: NetworkProps) {

  // TODO: figure out how to store the links and nodes from the map
  const [nodes, setNodes] = useState<CustomNode[]>([]);
  const [edges, setEdges] = useState<CustomLink[]>([]);
  const [graph, setGraph] = useState<GraphProps>();
  const [triggerBackend, setTriggerBackend] = useState<Boolean>(false)
  // let prevLayers: Map<number, number>;

  // const checkSameLayers = (prevLayers: Map<number, number>, newLayers: Map<number, number>): boolean => {
  //   // Check if sizes are different
  //   if (prevLayers.size !== newLayers.size) {
  //     return false;
  //   }
  //
  //   // Check if all entries are the same
  //   for (const [key, value] of prevLayers) {
  //     if (newLayers.get(key) !== value) {
  //       return false;
  //     }
  //   }
  //
  //   return true;
  // };
  //
  // const checkLayersSize = (prevLayers: Map<number, number>, newLayers: number): boolean => {
  //   if (prevLayers.size !== newLayers) {
  //     return false;
  //   }
  //   return true;
  // }

  const getNodes = (layerPerceptronMap: Map<number, number>) => {
    const result: CustomNode[] = [];
    var x: number = 100;
    const length = layerPerceptronMap.size
    console.log("len", length)
    for (const [layer, perceptrons] of layerPerceptronMap.entries()) {
      var y = 600 / (perceptrons + 1)
      var interval = 600 / (perceptrons + 1)
      for (let i = 0; i < perceptrons; i++) {
        const node: CustomNode = { x: x, y: y, value: 1, layer: layer, index: i };
        if (layer == 1) {
          // input
          node.color = "#FF6666"
          node.size = 16
        } else if (layer >= length) {
          // output
          node.color = "#64ff64"
          node.size = 16
        } else {
          node.color = "#448cfd"
        }

        result.push(node);
        y += interval;
      }
      x += 150;
    }
    return result;
  };

  const getEdges = (layerPerceptronMap: Map<number, number>, nodes: CustomNode[]) => {
    const result: CustomLink[] = [];
    const layerPerceptrons = Array.from(layerPerceptronMap.entries());

    var prevLayerNumNodes = layerPerceptrons[0][1];
    var prevLayer = nodes.slice(0, prevLayerNumNodes);
    var offset = prevLayerNumNodes;

    for (let i = 1; i < layerPerceptrons.length; i++) {
      const nextLayerNumNodes = layerPerceptrons[i][1];
      const nextLayer = nodes.slice(offset, offset + nextLayerNumNodes);

      for (const source of prevLayer) {
        for (const target of nextLayer) {
          const newLink: CustomLink = {
            source: source,
            target: target,
            value: 1,
            sourceLayer: source.layer,
            targetLayer: target.layer,
            sourceIndex: source.index,
            targetIndex: target.index
          };
          result.push(newLink);
        }
      }
      offset += nextLayerNumNodes;
      prevLayer = nextLayer;
    }
    return result;
  }

  useEffect(() => {
    const nodes = getNodes(layerPerceptronMap);
    setNodes(nodes);
    setEdges(getEdges(layerPerceptronMap, nodes));
    // if (prevLayers && checkSameLayers(prevLayers, layerPerceptronMap)) {
    setTriggerBackend(!triggerBackend)
    // }
    // prevLayers = layerPerceptronMap
  }, [layerPerceptronMap]);

  useEffect(() => {
    console.log("backend update")
    resetBackend().then(r =>
        setBackend(layerPerceptronMap).then(
            r => {
              // if (checkLayersSize(layerPerceptronMap, r.weights.size)) {
              //   setTriggerBackend(!triggerBackend)
              //   return
              // }
              setEdges(updateEdgeValue(edges, r.weights))
            }
        )
    )
  }, [triggerBackend]);

  useEffect(() => {
    if (weights[0]) {
      setEdges(updateEdgeValue(edges, weights[0].data.weights))
      setNodes(updateNodeValue(nodes, weights[0].data.weights))
    }
  }, [weights]);

  useEffect(() => {
    console.log("edges network", edges)
    setGraph({nodes: nodes, links: edges});
  }, [edges]);

  return width < 10 ? null : (
    <Box>
      {epoch[0] && (
          <Epoch epoch={epoch} />
      )}
      <svg width={width} height={height}>
        <Graph<CustomLink, CustomNode>
          graph={graph}
          top={30}
          left={100}
          nodeComponent={({node: {color, value, size}}) => {
            const adjustedColor = color ? adjustColorIntensity(color, value) : '#ffffff';
            return <DefaultNode r={size ? size : 20} fill={adjustedColor} />;
          }}
          linkComponent={({ link: { source, target, value } }) => (
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              strokeWidth={3 + Number(value)}
              stroke="#999"
              strokeOpacity={0.6}
              // strokeDasharray={dashed ? '8,4' : undefined}
            />
          )}
        />
      </svg>
    </Box>
  );
}
