import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Aegis-402 PayPal Escrow & Settlement Volume"

const chartData = [
  { date: "2024-04-01", authorized: 250, settled: 0 },
  { date: "2024-04-05", authorized: 500, settled: 250 },
  { date: "2024-04-10", authorized: 750, settled: 250 },
  { date: "2024-04-15", authorized: 900, settled: 500 },
  { date: "2024-04-20", authorized: 1200, settled: 750 },
  { date: "2024-04-25", authorized: 1400, settled: 900 },
  { date: "2024-04-30", authorized: 1750, settled: 1200 },
  { date: "2024-05-05", authorized: 2100, settled: 1500 },
  { date: "2024-05-10", authorized: 2350, settled: 1800 },
  { date: "2024-05-15", authorized: 2600, settled: 2100 },
  { date: "2024-05-20", authorized: 2950, settled: 2350 },
  { date: "2024-05-25", authorized: 3400, settled: 2800 },
  { date: "2024-05-30", authorized: 3800, settled: 3200 },
  { date: "2024-06-05", authorized: 4100, settled: 3500 },
  { date: "2024-06-10", authorized: 4500, settled: 3900 },
  { date: "2024-06-15", authorized: 4850, settled: 4200 },
  { date: "2024-06-20", authorized: 5200, settled: 4600 },
  { date: "2024-06-25", authorized: 5650, settled: 5000 },
  { date: "2024-06-30", authorized: 6100, settled: 5500 },
]

const chartConfig = {
  authorized: {
    label: "Escrow Authorized ($ USD)",
    color: "#0070ba",
  },
  settled: {
    label: "Captured Settlements ($ USD)",
    color: "#10b981",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="font-mono text-base font-medium">
          Escrow Volume & Verified Settlements
        </CardTitle>
        <CardDescription className="font-mono text-sm text-zinc-500">
          PayPal Orders v2 two-phase escrow trajectory (authorized vs captured)
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={(value) => {
              setTimeRange(value[0] ?? "90d")
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-3! @[767px]/card:flex font-mono text-sm"
          >
            <ToggleGroupItem value="90d">90 Days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 Days</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 Days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={(value) => {
              if (value !== null) {
                setTimeRange(value)
              }
            }}
          >
            <SelectTrigger
              className="flex w-32 font-mono text-sm @[767px]/card:hidden"
              size="sm"
            >
              <SelectValue placeholder="90 Days" />
            </SelectTrigger>
            <SelectContent className="rounded-md font-mono text-sm">
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[220px] w-full"
        >
          <LineChart data={filteredData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            {/* Squircle (rounded-square) dot markers per data point — no line/area wash */}
            <Line
              dataKey="authorized"
              type="monotone"
              stroke="none"
              dot={(props: any) => (
                <rect
                  key={props.key}
                  x={props.cx - 3.5}
                  y={props.cy - 3.5}
                  width={7}
                  height={7}
                  rx={2}
                  fill="#0070ba"
                />
              )}
              activeDot={(props: any) => (
                <rect
                  key={props.key}
                  x={props.cx - 5}
                  y={props.cy - 5}
                  width={10}
                  height={10}
                  rx={3}
                  fill="#0070ba"
                />
              )}
              strokeWidth={0}
            />
            <Line
              dataKey="settled"
              type="monotone"
              stroke="none"
              dot={(props: any) => (
                <rect
                  key={props.key}
                  x={props.cx - 3.5}
                  y={props.cy - 3.5}
                  width={7}
                  height={7}
                  rx={2}
                  fill="#10b981"
                />
              )}
              activeDot={(props: any) => (
                <rect
                  key={props.key}
                  x={props.cx - 5}
                  y={props.cy - 5}
                  width={10}
                  height={10}
                  rx={3}
                  fill="#10b981"
                />
              )}
              strokeWidth={0}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
